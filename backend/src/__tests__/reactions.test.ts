import type { ServerWebSocket } from "bun";
import { describe, expect, test } from "bun:test";
import { isReactionEmoji, reactionEmojis } from "@shared/types";
import type { WebSocketData } from "@shared/types";
import { REACTION_REFILL_INTERVAL_MS, ReactionRateLimiter } from "../reactionRateLimiter";

describe("room reactions", () => {
  test("the six picker reactions are accepted", () => {
    expect(reactionEmojis).toEqual(["👍", "🎉", "🤔", "👀", "⏳", "☕"]);
    reactionEmojis.forEach((emoji) => expect(isReactionEmoji(emoji)).toBe(true));
  });

  test("arbitrary strings and non-strings are rejected", () => {
    expect(isReactionEmoji("🔥")).toBe(false);
    expect(isReactionEmoji("👍👍")).toBe(false);
    expect(isReactionEmoji(undefined)).toBe(false);
  });

  test("allows a burst of three reactions, then returns the refill delay", () => {
    let now = 0;
    const limiter = new ReactionRateLimiter(() => now);
    const socket = {} as ServerWebSocket<WebSocketData>;

    expect(limiter.consume(socket).allowed).toBe(true);
    expect(limiter.consume(socket).allowed).toBe(true);
    expect(limiter.consume(socket).allowed).toBe(true);
    expect(limiter.consume(socket)).toEqual({
      allowed: false,
      retryAfterMs: REACTION_REFILL_INTERVAL_MS,
    });

    now = REACTION_REFILL_INTERVAL_MS / 2;
    expect(limiter.consume(socket)).toEqual({
      allowed: false,
      retryAfterMs: REACTION_REFILL_INTERVAL_MS / 2,
    });

    now = REACTION_REFILL_INTERVAL_MS;
    expect(limiter.consume(socket)).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  test("tracks each WebSocket independently and caps refilled tokens", () => {
    let now = 0;
    const limiter = new ReactionRateLimiter(() => now);
    const firstSocket = {} as ServerWebSocket<WebSocketData>;
    const secondSocket = {} as ServerWebSocket<WebSocketData>;

    for (let i = 0; i < 3; i++) expect(limiter.consume(firstSocket).allowed).toBe(true);
    expect(limiter.consume(firstSocket).allowed).toBe(false);
    expect(limiter.consume(secondSocket).allowed).toBe(true);

    now = REACTION_REFILL_INTERVAL_MS * 10;
    for (let i = 0; i < 3; i++) expect(limiter.consume(firstSocket).allowed).toBe(true);
    expect(limiter.consume(firstSocket).allowed).toBe(false);
  });
});
