type DisconnectEntry = {
  timer: ReturnType<typeof setTimeout>;
  onExpiry: () => void;
};

export class DisconnectManager {
  private disconnected = new Map<string, Map<string, DisconnectEntry>>();

  private getKey(roomId: string, username: string): string {
    return `${roomId}:${username}`;
  }

  markDisconnected(
    roomId: string,
    username: string,
    onExpiry: () => void,
    gracePeriodMs: number = 30_000,
  ): void {
    if (!this.disconnected.has(roomId)) {
      this.disconnected.set(roomId, new Map());
    }

    const timer = setTimeout(() => {
      this.disconnected.get(roomId)?.delete(username);
      if (this.disconnected.get(roomId)?.size === 0) {
        this.disconnected.delete(roomId);
      }
      onExpiry();
    }, gracePeriodMs);

    this.disconnected.get(roomId)!.set(username, { timer, onExpiry });
  }

  cancelDisconnect(roomId: string, username: string): boolean {
    const roomDisconnects = this.disconnected.get(roomId);
    if (!roomDisconnects) return false;

    const entry = roomDisconnects.get(username);
    if (!entry) return false;

    clearTimeout(entry.timer);
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
      clearTimeout(entry.timer);
    }

    this.disconnected.delete(roomId);
  }
}
