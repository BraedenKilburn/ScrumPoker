import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { FakeSocket } from "@/testing/fakeSocket";

const { route, router, toast } = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  toast: { add: vi.fn() },
}));

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => router,
}));

vi.mock("primevue/usetoast", () => ({
  useToast: () => toast,
}));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const audioStarts: number[] = [];

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = "running";
}

class FakeOscillatorNode {
  constructor(_context: FakeAudioContext, _options: { type: string; frequency: number }) {}

  connect(node: unknown) {
    return node as FakeGainNode;
  }

  start(time: number) {
    audioStarts.push(time);
  }

  stop() {}
}

class FakeGainNode {
  gain = {
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };

  constructor(_context: FakeAudioContext, _options: { gain: number }) {}

  connect() {
    return this;
  }
}

let useRootStore: typeof import("@/stores/root").useRootStore;
let useRoomSession: typeof import("../useRoomSession").useRoomSession;

beforeAll(async () => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  localStorage.setItem("sound-cues-enabled", "true");
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OscillatorNode", FakeOscillatorNode);
  vi.stubGlobal("GainNode", FakeGainNode);
  vi.stubEnv("VITE_SOCKET_URL", "ws://localhost:3000");
  vi.spyOn(performance, "now").mockReturnValue(1_000);

  ({ useRootStore } = await import("@/stores/root"));
  ({ useRoomSession } = await import("../useRoomSession"));
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("sound-cues-enabled", "true");
  FakeSocket.instances = [];
  audioStarts.length = 0;
  route.query = {};
  router.push.mockClear();
  router.replace.mockClear();
  toast.add.mockClear();
  setActivePinia(createPinia());
});

describe("useRoomSession sender echoes", () => {
  it("keeps the actor's optimistic vote when its masked broadcast echoes back", () => {
    const store = useRootStore();
    store.setUsername("voter");
    store.addParticipant({ username: "voter" });
    const session = useRoomSession("room1");

    session.vote("5");
    FakeSocket.instances.at(-1)!.emitMessage({
      type: "userVoted",
      data: { username: "voter", vote: "?" },
    });

    expect(store.pointEstimate).toBe("5");
    expect(store.participants.get("voter")).toBe("5");
  });

  it("acknowledges its own clear silently and cues a clear by another admin", () => {
    const store = useRootStore();
    store.setUsername("admin");
    store.addParticipant({ username: "admin" });
    const session = useRoomSession("room1");
    const socket = FakeSocket.instances.at(-1)!;

    session.vote("5");
    session.startNewRound();
    socket.emitMessage({
      type: "votesCleared",
      data: { clearedBy: "admin" },
    });

    expect(store.participants.get("admin")).toBeUndefined();
    expect(audioStarts).toEqual([]);

    session.vote("8");
    socket.emitMessage({
      type: "votesCleared",
      data: { clearedBy: "next-admin" },
    });

    expect(store.participants.get("admin")).toBeUndefined();
    expect(audioStarts).toHaveLength(1);
  });
});
