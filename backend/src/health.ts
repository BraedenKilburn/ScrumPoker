/**
 * Operational surface: the public `/health` answer and the knobs that
 * drive it. The response is a monitoring contract (Uptime Kuma checks
 * `status` with a Json Query), so it stays minimal and stable: `status`
 * is always exactly "ok" or "degraded", and nothing about rooms, users
 * or memory leaks out of a public endpoint.
 */

export type MemoryUsage = { rss: number; heapUsed: number };

/** The memory seam. Production passes `process.memoryUsage`; tests pin a value. */
export type MemoryReader = () => MemoryUsage;

export type HealthStatus = "ok" | "degraded";

export type HealthBody = {
  status: HealthStatus;
  uptimeSeconds: number;
  version: string;
};

const BYTES_PER_MB = 1024 * 1024;

export const toMb = (bytes: number): number => Math.round(bytes / BYTES_PER_MB);

/** Above the threshold is degraded; exactly at it is still fine. */
export const isOverRssLimit = (memory: MemoryUsage, maxRssMb: number): boolean =>
  memory.rss > maxRssMb * BYTES_PER_MB;

export function healthCheck(deps: {
  version: string;
  maxRssMb: number;
  uptimeSeconds: () => number;
  readMemory: MemoryReader;
}): Response {
  const degraded = isOverRssLimit(deps.readMemory(), deps.maxRssMb);
  const body: HealthBody = {
    status: degraded ? "degraded" : "ok",
    uptimeSeconds: Math.floor(deps.uptimeSeconds()),
    version: deps.version,
  };
  return Response.json(body, {
    status: degraded ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export type OpsConfig = {
  /** Git short SHA baked in at image build time; "dev" when unset. */
  version: string;
  maxRssMb: number;
  statsIntervalMs: number;
};

const DEFAULT_MAX_RSS_MB = 400;
const DEFAULT_STATS_INTERVAL_MS = 5 * 60_000;

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function opsConfigFromEnv(env: Record<string, string | undefined>): OpsConfig {
  return {
    version: env.GIT_SHA || "dev",
    maxRssMb: positiveNumber(env.HEALTH_MAX_RSS_MB, DEFAULT_MAX_RSS_MB),
    statsIntervalMs: positiveNumber(env.STATS_INTERVAL_MS, DEFAULT_STATS_INTERVAL_MS),
  };
}
