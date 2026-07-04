import { isDeckId, type DeckId } from "@shared/types";

const CHECK_ROOM_TIMEOUT_MS = 2000;

/**
 * HTTP base derived from VITE_SOCKET_URL by swapping the protocol while
 * keeping the path — in prod the socket URL is `wss://…/ws` and the API
 * rides the same NGINX-proxied `/ws` prefix, so the probe must hit
 * `…/ws/rooms/:id`.
 */
function apiBaseUrl(): string {
  const socketUrl = new URL(import.meta.env.VITE_SOCKET_URL);
  socketUrl.protocol = socketUrl.protocol === "wss:" ? "https:" : "http:";
  return socketUrl.toString().replace(/\/$/, "");
}

export type RoomCheck = {
  exists: boolean;
  deck: DeckId | null;
};

/**
 * Probe whether a room exists. Returns `null` when the check FAILED
 * (network error, timeout, non-JSON response) — deliberately distinct
 * from `{ exists: false }`; callers decide the fallback. A non-JSON 200
 * (the SPA's index.html answering a misrouted request) counts as failure.
 */
export async function checkRoom(roomId: string): Promise<RoomCheck | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/rooms/${encodeURIComponent(roomId)}`, {
      signal: AbortSignal.timeout(CHECK_ROOM_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = await response.json();
    if (typeof body?.exists !== "boolean") return null;

    return {
      exists: body.exists,
      deck: typeof body.deck === "string" && isDeckId(body.deck) ? body.deck : null,
    };
  } catch {
    return null;
  }
}
