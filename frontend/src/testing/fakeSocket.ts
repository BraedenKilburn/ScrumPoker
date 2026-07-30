import type { WebSocketLike } from "@/modules/roomConnection";

/**
 * Browser WebSocket boundary fake shared by connection and room-session
 * tests. Tests drive lifecycle events explicitly and inspect sent/close
 * behavior without replacing any application-owned collaborators.
 */
export class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;

  constructor(readonly url: URL) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closedWith = { code, reason };
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  emitClose(code: number, reason = "") {
    this.onclose?.({ code, reason });
  }
}
