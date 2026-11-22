import { describe, expect, test } from "bun:test";
import { healthCheck, opsConfigFromEnv } from "../health";

const MB = 1024 * 1024;

/** A memory reader pinned to the given resident size. */
const rssOf = (mb: number) => () => ({ rss: mb * MB, heapUsed: 10 * MB });

const check = (rssMb: number, maxRssMb = 400) =>
  healthCheck({
    version: "abc1234",
    maxRssMb,
    uptimeSeconds: () => 8123.7,
    readMemory: rssOf(rssMb),
  });

describe("healthCheck", () => {
  test("answers 200 ok with uptime and version, and nothing else", async () => {
    const response = check(120);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      uptimeSeconds: 8123,
      version: "abc1234",
    });
  });

  test("is never cached", () => {
    expect(check(120).headers.get("Cache-Control")).toBe("no-store");
  });

  test("RSS above the threshold answers 503 degraded with the same fields", async () => {
    const response = check(401);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "degraded",
      uptimeSeconds: 8123,
      version: "abc1234",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("RSS exactly at the threshold is still ok", () => {
    expect(check(400).status).toBe(200);
  });
});

describe("opsConfigFromEnv", () => {
  test("defaults: dev version, 400 MB threshold, five-minute stats interval", () => {
    expect(opsConfigFromEnv({})).toEqual({
      version: "dev",
      maxRssMb: 400,
      statsIntervalMs: 300_000,
    });
  });

  test("reads the git SHA and both tunables from the environment", () => {
    expect(
      opsConfigFromEnv({
        GIT_SHA: "98adede",
        HEALTH_MAX_RSS_MB: "250",
        STATS_INTERVAL_MS: "60000",
      }),
    ).toEqual({ version: "98adede", maxRssMb: 250, statsIntervalMs: 60_000 });
  });

  test("an empty GIT_SHA (build arg not passed) falls back to dev", () => {
    expect(opsConfigFromEnv({ GIT_SHA: "" }).version).toBe("dev");
  });

  test("unparseable or non-positive numbers fall back to the defaults", () => {
    const config = opsConfigFromEnv({ HEALTH_MAX_RSS_MB: "lots", STATS_INTERVAL_MS: "0" });

    expect(config.maxRssMb).toBe(400);
    expect(config.statsIntervalMs).toBe(300_000);
  });
});
