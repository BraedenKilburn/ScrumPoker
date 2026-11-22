import { beforeEach, describe, expect, test } from "bun:test";
import { startStatsReporter, type StatsLog } from "../statsReporter";
import { fakeScheduler } from "./testDoubles";

const MB = 1024 * 1024;

describe("startStatsReporter", () => {
  let clock: ReturnType<typeof fakeScheduler>;
  let lines: Array<{ level: "info" | "warn"; message: string }>;
  let rssMb: number;
  let log: StatsLog;

  beforeEach(() => {
    clock = fakeScheduler();
    lines = [];
    rssMb = 120;
    log = {
      info: (message) => lines.push({ level: "info", message }),
      warn: (message) => lines.push({ level: "warn", message }),
    };
  });

  const start = () =>
    startStatsReporter({
      scheduler: clock.scheduler,
      intervalMs: 1000,
      maxRssMb: 400,
      readMemory: () => ({ rss: rssMb * MB, heapUsed: 42.4 * MB }),
      readCounts: () => ({ rooms: 2, members: 5, connections: 4, absentMembers: 1 }),
      log,
    });

  test("logs nothing until the first interval elapses", () => {
    start();

    clock.advance(999);
    expect(lines).toEqual([]);
  });

  test("logs one info stats line per interval with counts and memory in MB", () => {
    start();

    clock.advance(1000);
    // A single physical line, so each tick is one Docker json-file entry
    // and `grep stats` returns the numbers, not just a header.
    expect(lines).toEqual([
      {
        level: "info",
        message:
          'stats {"rooms":2,"members":5,"connections":4,"absentMembers":1,"rssMb":120,"heapUsedMb":42}',
      },
    ]);

    clock.advance(1000);
    clock.advance(1000);
    expect(lines).toHaveLength(3);
  });

  test("logs at warn level while RSS is above the threshold", () => {
    start();

    rssMb = 401;
    clock.advance(1000);
    rssMb = 300;
    clock.advance(1000);

    expect(lines.map((line) => line.level)).toEqual(["warn", "info"]);
  });

  test("stop cancels the pending tick", () => {
    const reporter = start();
    clock.advance(1000);

    reporter.stop();
    clock.advance(5000);

    expect(lines).toHaveLength(1);
    expect(clock.pendingCount()).toBe(0);
  });
});
