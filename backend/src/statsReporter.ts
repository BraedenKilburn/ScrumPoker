import type { Scheduler } from "./disconnectManager";
import { isOverRssLimit, toMb, type MemoryReader } from "./health";

export type StatsCounts = {
  rooms: number;
  members: number;
  connections: number;
  /** Members inside their grace period: on the roster, no live socket. */
  absentMembers: number;
};

export type StatsLog = {
  info(message: string): void;
  warn(message: string): void;
};

/**
 * Logs one `stats` line every interval: usage counts plus process
 * memory, at `warn` once RSS crosses the health threshold. Answers "how
 * many people use it, and how close am I to the limits?" from the
 * container logs alone. Docker's json-file rotation handles retention.
 *
 * Driven by the same one-shot Scheduler seam as DisconnectManager, so
 * each tick re-arms the next one, and tests advance a fake clock.
 */
export function startStatsReporter(deps: {
  scheduler: Scheduler;
  intervalMs: number;
  maxRssMb: number;
  readMemory: MemoryReader;
  readCounts: () => StatsCounts;
  log: StatsLog;
}): { stop(): void } {
  let timer: unknown;

  const tick = () => {
    const memory = deps.readMemory();
    const line = {
      ...deps.readCounts(),
      rssMb: toMb(memory.rss),
      heapUsedMb: toMb(memory.heapUsed),
    };
    // Serialized here rather than passed as log data: console.log would
    // pretty-print the object across several lines.
    const message = `stats ${JSON.stringify(line)}`;
    if (isOverRssLimit(memory, deps.maxRssMb)) deps.log.warn(message);
    else deps.log.info(message);
    arm();
  };

  const arm = () => {
    timer = deps.scheduler.schedule(tick, deps.intervalMs);
  };

  arm();
  return { stop: () => deps.scheduler.cancel(timer) };
}
