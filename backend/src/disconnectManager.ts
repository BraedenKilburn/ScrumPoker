type DisconnectEntry = {
  timer: unknown;
};

/**
 * The scheduling seam. Production passes real timers; tests pass a fake
 * clock so grace-period expiry is asserted by advancing time rather than
 * by sleeping. Mirrors the injectable clock in ReactionRateLimiter.
 */
export type Scheduler = {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(timer: unknown): void;
};

const realTimers: Scheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/**
 * Who is inside the disconnect grace period: a member of the room roster
 * with no live socket. Timer handles never escape — callers mark, cancel,
 * or ask, and the entry cleans itself up before onExpiry runs so the
 * callback sees consistent state.
 */
export class DisconnectManager {
  private disconnected = new Map<string, Map<string, DisconnectEntry>>();

  constructor(private readonly scheduler: Scheduler = realTimers) {}

  markDisconnected(
    roomId: string,
    username: string,
    onExpiry: () => void,
    gracePeriodMs: number = 30_000,
  ): void {
    if (!this.disconnected.has(roomId)) {
      this.disconnected.set(roomId, new Map());
    }

    const timer = this.scheduler.schedule(() => {
      this.disconnected.get(roomId)?.delete(username);
      if (this.disconnected.get(roomId)?.size === 0) {
        this.disconnected.delete(roomId);
      }
      onExpiry();
    }, gracePeriodMs);

    this.disconnected.get(roomId)!.set(username, { timer });
  }

  cancelDisconnect(roomId: string, username: string): boolean {
    const roomDisconnects = this.disconnected.get(roomId);
    if (!roomDisconnects) return false;

    const entry = roomDisconnects.get(username);
    if (!entry) return false;

    this.scheduler.cancel(entry.timer);
    roomDisconnects.delete(username);

    if (roomDisconnects.size === 0) {
      this.disconnected.delete(roomId);
    }

    return true;
  }

  isDisconnected(roomId: string, username: string): boolean {
    return this.disconnected.get(roomId)?.has(username) ?? false;
  }

  clearRoom(roomId: string): void {
    const roomDisconnects = this.disconnected.get(roomId);
    if (!roomDisconnects) return;

    for (const entry of roomDisconnects.values()) {
      this.scheduler.cancel(entry.timer);
    }

    this.disconnected.delete(roomId);
  }
}
