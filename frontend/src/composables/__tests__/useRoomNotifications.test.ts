import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useRoomNotifications } from "../useRoomNotifications";
import type { NotificationBrowser } from "@/modules/notificationBrowser";

function permissionBrowser() {
  const values = new Map<string, string>();
  const requestPermission = vi.fn(async (): Promise<NotificationPermission> => "granted");
  const browser = {
    supported: true,
    read: (key: string) => values.get(key) ?? null,
    write: (key: string, value: string) => {
      values.set(key, value);
    },
    permission: () => "default",
    requestPermission,
    listen: () => () => {},
  } as unknown as NotificationBrowser;
  return { browser, requestPermission };
}

describe("room notification preference", () => {
  it("defaults off and requests permission only on explicit enable, remembering the choice", async () => {
    const { browser, requestPermission } = permissionBrowser();
    const options = {
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("disconnected" as const),
      soundEnabled: ref(false),
      playCue: vi.fn(),
      browser,
    };
    const first = useRoomNotifications(options);
    expect(first.notificationsEnabled.value).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
    await first.toggleNotifications();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(first.notificationsEnabled.value).toBe(true);
    first.dispose();
    const second = useRoomNotifications(options);
    expect(second.notificationsEnabled.value).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    second.dispose();
  });
});

import { notificationBrowserFamily, settleNotifications } from "@/testing/fakeNotificationBrowser";

it("shows a silent background alert and closes it when the room becomes active", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tab = family.tab();
  const playCue = vi.fn();
  const alerts = useRoomNotifications({
    roomId: "room1",
    username: ref("voter"),
    connectionStatus: ref("connected"),
    soundEnabled: ref(false),
    playCue,
    browser: tab.browser,
  });
  alerts.newRound({ stream: "server", sequence: 1, actor: "admin" });
  await settleNotifications();
  expect(tab.shown).toHaveLength(1);
  expect(tab.shown[0]).toMatchObject({
    title: "room1",
    options: { body: "New round started", silent: true },
    closed: false,
  });
  expect(playCue).not.toHaveBeenCalled();
  tab.setActive(true);
  await settleNotifications();
  expect(tab.shown[0]!.closed).toBe(true);
  alerts.dispose();
});

it("coordinates two background copies, suppresses both app cues, and replaces the previous notification", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tabs = [family.tab(), family.tab()];
  const cues = [vi.fn(), vi.fn()];
  const alerts = tabs.map((tab, i) =>
    useRoomNotifications({
      roomId: "room1",
      username: ref(`voter${i}`),
      connectionStatus: ref("connected"),
      soundEnabled: ref(true),
      playCue: cues[i]!,
      browser: tab.browser,
    }),
  );
  const first = { stream: "server", sequence: 1, actor: "admin" };
  alerts.forEach((a) => a.newRound(first));
  await settleNotifications();
  expect(tabs.flatMap((t) => t.shown)).toHaveLength(1);
  expect(tabs.flatMap((t) => t.shown)[0]!.options.silent).not.toBe(true);
  cues.forEach((cue) => expect(cue).not.toHaveBeenCalled());
  alerts.forEach((a) => a.reveal({ ...first, sequence: 2 }));
  await settleNotifications();
  const shown = tabs.flatMap((t) => t.shown);
  expect(shown).toHaveLength(2);
  expect(shown[0]!.closed).toBe(true);
  expect(shown[1]!.options.body).toBe("Votes revealed");
  alerts.forEach((a) => a.dispose());
});

it("suppresses background notifications while another copy is active, then transfers ownership without replay", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tabs = [family.tab(), family.tab()];
  tabs[1]!.setActive(true);
  const cues = [vi.fn(), vi.fn()];
  const alerts = tabs.map((tab, i) =>
    useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("connected"),
      soundEnabled: ref(true),
      playCue: cues[i]!,
      browser: tab.browser,
    }),
  );
  alerts.forEach((a) => a.newRound({ stream: "server", sequence: 1, actor: "admin" }));
  await settleNotifications();
  expect(tabs.flatMap((t) => t.shown)).toEqual([]);
  expect(cues[0]).not.toHaveBeenCalled();
  expect(cues[1]).toHaveBeenCalledWith("newRound");
  tabs[1]!.setActive(false);
  alerts[0]!.dispose();
  await settleNotifications();
  expect(tabs.flatMap((t) => t.shown)).toEqual([]);
  alerts[1]!.reveal({ stream: "server", sequence: 2, actor: "admin" });
  await settleNotifications();
  expect(tabs[1]!.shown).toHaveLength(1);
  tabs[1]!.shown[0]!.click();
  expect(tabs[1]!.focusCount).toBe(1);
  expect(tabs[1]!.shown[0]!.closed).toBe(true);
  alerts[1]!.dispose();
});

it("does not replay pending alerts after disconnect and ignores own actions", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tab = family.tab();
  const connectionStatus = ref<import("@/modules/roomConnection").ConnectionStatus>("connected");
  const alerts = useRoomNotifications({
    roomId: "room1",
    username: ref("admin"),
    connectionStatus,
    soundEnabled: ref(false),
    playCue: vi.fn(),
    browser: tab.browser,
  });
  alerts.newRound({ stream: "server", sequence: 1, actor: "admin" });
  await settleNotifications();
  expect(tab.shown).toEqual([]);
  alerts.reveal({ stream: "server", sequence: 2, actor: "other" });
  connectionStatus.value = "disconnected";
  await settleNotifications();
  connectionStatus.value = "connected";
  await settleNotifications();
  expect(tab.shown).toEqual([]);
  alerts.newRound({ stream: "server", sequence: 3, actor: "other" });
  await settleNotifications();
  expect(tab.shown).toHaveLength(1);
  alerts.dispose();
});

it("never replays a foreground event when another copy receives it after focus moves away", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const foreground = family.tab();
  const background = family.tab();
  foreground.setActive(true);
  const create = (browser: NotificationBrowser) =>
    useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("connected"),
      soundEnabled: ref(true),
      playCue: vi.fn(),
      browser,
    });
  const a = create(foreground.browser),
    b = create(background.browser);
  await settleNotifications();
  const event = { stream: "server", sequence: 1, actor: "admin" };
  a.newRound(event);
  foreground.setActive(false);
  await settleNotifications();
  b.newRound(event);
  await settleNotifications();
  expect([...foreground.shown, ...background.shown]).toEqual([]);
  a.dispose();
  b.dispose();
});

it("explains denied and unsupported permission without prompting again", async () => {
  const { browser, requestPermission } = permissionBrowser();
  browser.permission = () => "denied";
  const make = () =>
    useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("disconnected"),
      soundEnabled: ref(false),
      playCue: vi.fn(),
      browser,
    });
  const denied = make();
  await denied.toggleNotifications();
  expect(denied.notificationDescription.value).toContain("blocked");
  expect(denied.notificationsEnabled.value).toBe(false);
  expect(requestPermission).not.toHaveBeenCalled();
  denied.dispose();
  browser.supported = false;
  const unsupported = make();
  expect(unsupported.notificationDescription.value).toContain("not supported");
  expect(unsupported.notificationsUnavailable.value).toBe(true);
  await unsupported.toggleNotifications();
  expect(requestPermission).not.toHaveBeenCalled();
  unsupported.dispose();
});

it("leaves dismissed permission off and prevents an outstanding permission response from enabling a disposed session", async () => {
  const { browser, requestPermission } = permissionBrowser();
  requestPermission.mockResolvedValueOnce("default");
  const make = () =>
    useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("disconnected"),
      soundEnabled: ref(false),
      playCue: vi.fn(),
      browser,
    });
  const alerts = make();
  await alerts.toggleNotifications();
  expect(alerts.notificationsEnabled.value).toBe(false);
  let grant!: (value: NotificationPermission) => void;
  browser.requestPermission = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  const enabling = alerts.toggleNotifications();
  alerts.dispose();
  grant("granted");
  await enabling;
  const reopened = make();
  expect(reopened.notificationsEnabled.value).toBe(false);
  reopened.dispose();
});

it("keeps app cues when disabled and closes existing notifications when toggled off", async () => {
  const family = notificationBrowserFamily();
  const tab = family.tab();
  const cue = vi.fn();
  const alerts = useRoomNotifications({
    roomId: "room1",
    username: ref("voter"),
    connectionStatus: ref("connected"),
    soundEnabled: ref(true),
    playCue: cue,
    browser: tab.browser,
  });
  alerts.newRound({ stream: "server", sequence: 1, actor: "admin" });
  expect(cue).toHaveBeenCalledWith("newRound");
  await alerts.toggleNotifications();
  alerts.reveal({ stream: "server", sequence: 2, actor: "admin" });
  await settleNotifications();
  expect(tab.shown).toHaveLength(1);
  await alerts.toggleNotifications();
  expect(tab.shown[0]!.closed).toBe(true);
  alerts.dispose();
});

it("handles rejected permission and storage failures without breaking the room", async () => {
  const { browser } = permissionBrowser();
  browser.requestPermission = async () => {
    throw new Error("permission failed");
  };
  const alerts = useRoomNotifications({
    roomId: "room1",
    username: ref("voter"),
    connectionStatus: ref("disconnected"),
    soundEnabled: ref(false),
    playCue: vi.fn(),
    browser,
  });
  await expect(alerts.toggleNotifications()).resolves.toBeUndefined();
  expect(alerts.notificationDescription.value).toContain("could not be enabled");
  alerts.dispose();
  browser.read = () => {
    throw new Error("blocked storage");
  };
  const blocked = useRoomNotifications({
    roomId: "room1",
    username: ref("voter"),
    connectionStatus: ref("disconnected"),
    soundEnabled: ref(false),
    playCue: vi.fn(),
    browser,
  });
  expect(blocked.notificationDescription.value).toContain("storage is unavailable");
  blocked.dispose();
});

it("drops delivery delayed by a suspended tab instead of showing a catch-up alert", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tab = family.tab();
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  const alerts = useRoomNotifications({
    roomId: "room1",
    username: ref("voter"),
    connectionStatus: ref("connected"),
    soundEnabled: ref(false),
    playCue: vi.fn(),
    browser: tab.browser,
  });
  alerts.newRound({ stream: "server", sequence: 1, actor: "admin" });
  now.mockReturnValue(31_000);
  await settleNotifications();
  expect(tab.shown).toEqual([]);
  alerts.dispose();
  now.mockRestore();
});

it("does not play an app cue when an already notified event reaches a newly focused copy", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tabs = [family.tab(), family.tab()];
  const cues = [vi.fn(), vi.fn()];
  const alerts = tabs.map((tab, i) =>
    useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("connected"),
      soundEnabled: ref(true),
      playCue: cues[i]!,
      browser: tab.browser,
    }),
  );
  const event = { stream: "server", sequence: 1, actor: "admin" };
  alerts[0]!.newRound(event);
  await settleNotifications();
  expect(tabs.flatMap((t) => t.shown)).toHaveLength(1);
  tabs[1]!.setActive(true);
  alerts[1]!.newRound(event);
  await settleNotifications();
  expect(cues[1]).not.toHaveBeenCalled();
  alerts.forEach((a) => a.dispose());
});

it("transfers notification ownership to an eligible member when the owner initiated the action", async () => {
  const family = notificationBrowserFamily();
  family.values.set("desktop-notifications-enabled", "true");
  const tabs = [family.tab(), family.tab()];
  const alerts = tabs.map((tab, i) =>
    useRoomNotifications({
      roomId: "room1",
      username: ref(i === 0 ? "admin" : "voter"),
      connectionStatus: ref("connected"),
      soundEnabled: ref(true),
      playCue: vi.fn(),
      browser: tab.browser,
    }),
  );
  await settleNotifications();
  const event = { stream: "server", sequence: 1, actor: "admin" };
  alerts.forEach((a) => a.newRound(event));
  await settleNotifications();
  expect(tabs[0]!.shown).toEqual([]);
  expect(tabs[1]!.shown).toHaveLength(1);
  tabs[1]!.shown[0]!.click();
  expect(tabs[1]!.focusCount).toBe(1);
  alerts.forEach((a) => a.dispose());
});

it("keeps unsupported insecure contexts usable when secure-context UUID generation is absent", () => {
  const { browser } = permissionBrowser();
  browser.supported = false;
  vi.stubGlobal("crypto", {});
  try {
    const alerts = useRoomNotifications({
      roomId: "room1",
      username: ref("voter"),
      connectionStatus: ref("disconnected"),
      soundEnabled: ref(false),
      playCue: vi.fn(),
      browser,
    });
    expect(alerts.notificationsUnavailable.value).toBe(true);
    alerts.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
