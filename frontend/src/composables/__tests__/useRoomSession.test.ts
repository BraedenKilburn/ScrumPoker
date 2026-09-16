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

describe("room session desktop notifications", () => {
  it("keeps snapshots silent and routes clear, deck change, and re-reveal events for spectators", async () => {
    const { notificationBrowserFamily, settleNotifications } =
      await import("@/testing/fakeNotificationBrowser");
    const family = notificationBrowserFamily();
    family.values.set("desktop-notifications-enabled", "true");
    const tab = family.tab();
    const store = useRootStore();
    store.setUsername("watcher");
    const session = useRoomSession("room1", { notificationBrowser: tab.browser });
    const socket = FakeSocket.instances.at(-1)!;
    socket.emitOpen();
    const snapshot = {
      type: "joinRoomSuccess",
      data: {
        participants: { admin: null },
        spectators: ["watcher"],
        admin: "admin",
        locked: false,
        revealed: true,
        deck: "fibonacci",
      },
    };
    socket.emitMessage(snapshot);
    await settleNotifications();
    expect(tab.shown).toEqual([]);
    const event = { stream: "server", sequence: 1, actor: "admin" };
    socket.emitMessage({ type: "votesCleared", data: { clearedBy: "admin" }, event });
    await settleNotifications();
    expect(tab.shown.at(-1)?.title).toBe("room1 — New round started");
    socket.emitMessage({
      type: "voteStatus",
      data: { revealed: true, votes: { admin: "5" } },
      event: { ...event, sequence: 2 },
    });
    await settleNotifications();
    expect(tab.shown.at(-1)?.title).toBe("room1 — Votes revealed");
    socket.emitMessage({
      type: "voteStatus",
      data: { revealed: false, votes: { admin: "?" } },
      event: { ...event, sequence: 3 },
    });
    socket.emitMessage({
      type: "voteStatus",
      data: { revealed: true, votes: { admin: "5" } },
      event: { ...event, sequence: 4 },
    });
    await settleNotifications();
    expect(tab.shown).toHaveLength(3);
    socket.emitMessage({
      type: "deckChanged",
      data: { deck: "tshirt" },
      event: { ...event, sequence: 5 },
    });
    await settleNotifications();
    expect(tab.shown.at(-1)?.title).toBe("room1 — New round started");
    expect(audioStarts).toEqual([]);
    socket.emitMessage(snapshot);
    await settleNotifications();
    expect(tab.shown).toHaveLength(4);
    session.teardownRoomSession();
    expect(tab.shown.every((n) => n.closed)).toBe(true);
  });
});

it("suppresses the admin's own native alerts and uses original foreground sound only when enabled", async () => {
  const { notificationBrowserFamily, settleNotifications } =
    await import("@/testing/fakeNotificationBrowser");
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tab = family.tab();
  const store = useRootStore();
  store.setUsername("admin");
  const session = useRoomSession("room1", { notificationBrowser: tab.browser });
  const socket = FakeSocket.instances.at(-1)!;
  socket.emitOpen();
  socket.emitMessage({
    type: "deckChanged",
    data: { deck: "tshirt" },
    event: { stream: "server", sequence: 1, actor: "admin" },
  });
  socket.emitMessage({
    type: "voteStatus",
    data: { revealed: true, votes: {} },
    event: { stream: "server", sequence: 2, actor: "admin" },
  });
  await settleNotifications();
  expect(tab.shown).toEqual([]);
  expect(audioStarts).toEqual([]);
  tab.setActive(true);
  vi.spyOn(performance, "now").mockReturnValue(10_000);
  socket.emitMessage({
    type: "votesCleared",
    data: { clearedBy: "other" },
    event: { stream: "server", sequence: 3, actor: "other" },
  });
  await settleNotifications();
  expect(audioStarts).toHaveLength(1);
  session.toggleSoundCues();
  vi.spyOn(performance, "now").mockReturnValue(20_000);
  socket.emitMessage({
    type: "voteStatus",
    data: { revealed: true, votes: {} },
    event: { stream: "server", sequence: 4, actor: "other" },
  });
  await settleNotifications();
  expect(audioStarts).toHaveLength(1);
  expect(tab.shown).toEqual([]);
  session.teardownRoomSession();
});

it("respects Sound being disabled in another tab before a foreground cue", async () => {
  const { notificationBrowserFamily, settleNotifications } =
    await import("@/testing/fakeNotificationBrowser");
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tab = family.tab();
  tab.setActive(true);
  useRootStore().setUsername("voter");
  const session = useRoomSession("room1", { notificationBrowser: tab.browser });
  if (!session.soundCuesEnabled.value) session.toggleSoundCues();
  audioStarts.length = 0;
  localStorage.setItem("sound-cues-enabled", "false");
  vi.spyOn(performance, "now").mockReturnValue(30_000);
  const socket = FakeSocket.instances.at(-1)!;
  socket.emitOpen();
  socket.emitMessage({
    type: "votesCleared",
    data: { clearedBy: "admin" },
    event: { stream: "server", sequence: 1, actor: "admin" },
  });
  await settleNotifications();
  expect(audioStarts).toEqual([]);
  session.teardownRoomSession();
});
