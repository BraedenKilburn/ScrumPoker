#!/usr/bin/env bun
// Pre-compress built static assets at maximum level so Caddy can serve them via
// `file_server { precompressed br gzip }`: best possible ratio with zero
// per-request CPU. Caddy's core `encode` covers gzip and zstd but not brotli,
// so these .br files are the only path by which brotli reaches a client.
// Safe because the whole dist/ tree is rebuilt from scratch each deploy, so a
// *.br/*.gz is always regenerated beside the file it came from — never edit a
// file under /var/www/scrum-poker by hand without rerunning this.
// Run from deploy.sh after `bun build`.
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

// Already-compressed formats (woff2, png, jpg, gif, ico) are skipped —
// recompressing them wastes space and CPU. `.html` is included so the SPA
// entrypoint gets brotli too: it is served on every cold load and is the one
// compressible file Vite does not fingerprint.
const COMPRESSIBLE = new Set([
  ".js",
  ".css",
  ".svg",
  ".json",
  ".wasm",
  ".map",
  ".html",
]);
const MIN_BYTES = 256; // tiny files don't benefit from compression

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
