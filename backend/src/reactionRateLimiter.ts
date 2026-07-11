import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "@shared/types";

export const REACTION_BUCKET_CAPACITY = 3;
export const REACTION_REFILL_INTERVAL_MS = 1500;

type ReactionBucket = {
  tokens: number;
  lastRefillAt: number;
};

export type ReactionRateLimitResult =
  | { allowed: true; retryAfterMs: 0 }
  | { allowed: false; retryAfterMs: number };

/**
 * Per-connection token bucket. Weak keys let closed sockets and their
 * buckets be garbage-collected without explicit room or disconnect state.
 */
export class ReactionRateLimiter {
  private readonly buckets = new WeakMap<ServerWebSocket<WebSocketData>, ReactionBucket>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(socket: ServerWebSocket<WebSocketData>): ReactionRateLimitResult {
    const now = this.now();
    const bucket = this.buckets.get(socket) ?? {
      tokens: REACTION_BUCKET_CAPACITY,
      lastRefillAt: now,
    };
    const effectiveNow = Math.max(now, bucket.lastRefillAt);
    const elapsed = effectiveNow - bucket.lastRefillAt;

    bucket.tokens = Math.min(
      REACTION_BUCKET_CAPACITY,
      bucket.tokens + elapsed / REACTION_REFILL_INTERVAL_MS,
    );
    bucket.lastRefillAt = effectiveNow;
    this.buckets.set(socket, bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.ceil((1 - bucket.tokens) * REACTION_REFILL_INTERVAL_MS),
    };
  }
}
