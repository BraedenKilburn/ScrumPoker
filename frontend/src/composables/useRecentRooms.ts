import { computed, ref, watch } from "vue";
import { isDeckId, type DeckId } from "@shared/types";

export type RecentRoom = {
  id: string;
  username: string;
  joinedAt: number;
  /**
   * The deck last seen in this room — a best-effort hint so one-click
   * rejoin can recreate a dead room on the same scale, never a source
   * of truth for live rooms.
   */
  deck?: DeckId;
};

const RECENT_ROOMS_STORAGE_KEY = "scrum-poker-recent-rooms";
const MAX_RECENT_ROOMS = 3;

function getStoredRooms() {
  try {
    const rooms = JSON.parse(
      localStorage.getItem(RECENT_ROOMS_STORAGE_KEY) ?? "[]",
    ) as RecentRoom[];
    // Old entries have no deck; tolerate corrupt values by treating them as absent.
    return rooms.map(({ deck, ...room }) => ({
      ...room,
      ...(typeof deck === "string" && isDeckId(deck) ? { deck } : {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Stamp the deck last seen in a room onto its recent-rooms entry.
 * Standalone (straight to localStorage) because the composable's state is
 * per-instance; no-op if the room isn't in the recent list.
 */
export function rememberRoomDeck(roomId: string, deck: DeckId): void {
  const rooms = getStoredRooms();
  const entry = rooms.find((room) => room.id.toLowerCase() === roomId.toLowerCase());
  if (!entry || entry.deck === deck) return;

  entry.deck = deck;
  localStorage.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
}

export function useRecentRooms() {
  const storedRooms = ref<RecentRoom[]>(getStoredRooms());

  watch(
    storedRooms,
    (rooms) => {
      localStorage.setItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(rooms));
    },
    { deep: true },
  );

  const rooms = computed(() =>
    storedRooms.value
      .filter((room) => room.id && room.username && room.joinedAt)
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .slice(0, MAX_RECENT_ROOMS),
  );

  function save(room: RecentRoom) {
    storedRooms.value = [
      room,
      ...storedRooms.value.filter(
        (recentRoom) => recentRoom.id.toLowerCase() !== room.id.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT_ROOMS);
  }

  function clear() {
    storedRooms.value = [];
  }

  return {
    rooms,
    save,
    clear,
  };
}
