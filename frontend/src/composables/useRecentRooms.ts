import { computed, ref, watch } from "vue";

export type RecentRoom = {
  id: string;
  username: string;
  joinedAt: number;
};

const RECENT_ROOMS_STORAGE_KEY = "scrum-poker-recent-rooms";
const MAX_RECENT_ROOMS = 3;

function getStoredRooms() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_STORAGE_KEY) ?? "[]") as RecentRoom[];
  } catch {
    return [];
  }
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
