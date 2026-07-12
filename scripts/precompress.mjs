#!/usr/bin/env bun
// Pre-compress built static assets at maximum level so nginx can serve them via
// brotli_static / gzip_static: best possible ratio with zero per-request CPU.
// Safe because Vite fingerprints these filenames — a *.br/*.gz is produced once
// per build and lives beside the original. Run from deploy.sh after `bun build`.
//
//   bun scripts/precompress.mjs <dir>
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const root = process.argv[2];
if (!root) {
  console.error("usage: bun scripts/precompress.mjs <dir>");
  process.exit(1);
}

// Mirror nginx brotli_types/gzip_types. Already-compressed formats (woff2, png,
// jpg, gif, ico) are skipped — recompressing them wastes space and CPU.
const COMPRESSIBLE = new Set([".js", ".css", ".svg", ".json", ".wasm", ".map"]);
const MIN_BYTES = 256; // matches *_min_length; tiny files don't benefit

let count = 0;
let brSaved = 0;
let gzSaved = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
      continue;
    }
    if (name.endsWith(".br") || name.endsWith(".gz")) continue;
    if (!COMPRESSIBLE.has(extname(name)) || st.size < MIN_BYTES) continue;

    const buf = readFileSync(path);

    // Brotli at quality 11 (max). Only keep it if it actually beats the original.
    const br = brotliCompressSync(buf, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    });
    if (br.length < buf.length) {
      writeFileSync(`${path}.br`, br);
      brSaved += buf.length - br.length;
    }

    // gzip at level 9 (max) for clients that don't speak brotli.
    const gz = gzipSync(buf, { level: 9 });
    if (gz.length < buf.length) {
      writeFileSync(`${path}.gz`, gz);
      gzSaved += buf.length - gz.length;
    }

    count += 1;
  }
}

walk(root);
console.log(
  `pre-compressed ${count} files — brotli saved ${(brSaved / 1024).toFixed(1)} KiB, ` +
    `gzip saved ${(gzSaved / 1024).toFixed(1)} KiB`,
);
