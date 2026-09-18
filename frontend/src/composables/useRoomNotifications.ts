import { computed, ref, watch, type Ref } from "vue";
import type { RoomAlertEvent } from "@shared/types";
import type { ConnectionStatus } from "@/modules/roomConnection";
import { createNotificationBrowser, type NotificationBrowser } from "@/modules/notificationBrowser";

export type RoomCue = "newRound" | "reveal";
const preferenceKey = "desktop-notifications-enabled";
// Native alerts are live nudges, not a queue to replay when a tab resumes.
const deliveryWindowMs = 5_000;
type PendingAlert = {
  kind: RoomCue;
  event: RoomAlertEvent;
  viewed: boolean;
  tabId: string;
  receivedAt: number;
};

export function useRoomNotifications(options: {
  roomId: string;
  username: Ref<string>;
  connectionStatus: Ref<ConnectionStatus>;
  playCue: (kind: RoomCue) => void;
  browser?: NotificationBrowser;
}) {
  const browser = options.browser ?? createNotificationBrowser();
  const notificationsEnabled = ref(false);
  const permission = ref(browser.permission());
  const requesting = ref(false);
  const error = ref("");
  const available = ref(browser.supported);
  const prefix = `scrumpoker:notifications:${options.roomId}`;
  const tabId = browser.supported ? crypto.randomUUID() : "";
  const activePrefix = `${prefix}:active:`;
  const activeLock = `${activePrefix}${tabId}`;
  const pending = new Map<string, PendingAlert>();
  let disposed = false;
  let channel: ReturnType<NotificationBrowser["channel"]> | undefined;
  let ownerRequest: AbortController | undefined;
  let activeRequest: AbortController | undefined;
  let releaseOwner: (() => void) | undefined;
  let releaseActive: (() => void) | undefined;
  let owner = false;
  let delivery = Promise.resolve();
  let notification: { close(): void } | undefined;

  function dismiss() {
    notification?.close();
    notification = undefined;
  }
  function refresh() {
    try {
      notificationsEnabled.value = browser.read(preferenceKey) === "true";
    } catch {
      available.value = false;
      error.value = "Browser storage is unavailable. Notifications cannot be enabled.";
    }
    permission.value = browser.permission();
    if (!notificationsEnabled.value || permission.value !== "granted") dismiss();
  }
  refresh();
  const notificationsUnavailable = computed(
    () =>
      requesting.value ||
      (!notificationsEnabled.value && (!available.value || permission.value === "denied")),
  );
  const notificationDescription = computed(() => {
    if (error.value) return error.value;
    if (!available.value)
      return "Desktop notifications are not supported in this browser. Use a current desktop browser over HTTPS.";
    if (permission.value === "denied")
      return "Notifications are blocked. Allow notifications for this site in your browser settings.";
    if (requesting.value) return "Waiting for notification permission…";
    return "Notify you about new rounds and revealed votes in another tab or app. Notification sound follows your system settings.";
  });

  async function toggleNotifications() {
    if (disposed || requesting.value) return;
    try {
      if (notificationsEnabled.value) {
        browser.write(preferenceKey, "false");
        notificationsEnabled.value = false;
        dismiss();
        channel?.postMessage({ type: "dismiss" });
        return;
      }
      if (!available.value) return;
      error.value = "";
      permission.value = browser.permission();
      if (permission.value === "denied") return;
      if (permission.value === "default") {
        requesting.value = true;
        permission.value = await browser.requestPermission();
      }
      if (!disposed && permission.value === "granted") {
        browser.write(preferenceKey, "true");
        notificationsEnabled.value = true;
      }
    } catch {
      error.value =
        "Notifications could not be enabled. Check your browser's site settings and try again.";
    } finally {
      requesting.value = false;
    }
  }

  // Holding a shared lock advertises active viewing without heartbeat timers.
  // Browsers release locks on tab termination, so a crashed tab cannot leave
  // a stale 'active' flag that suppresses every other tab indefinitely.
  function updateActivity() {
    if (!channel) return;
    if (browser.active()) {
      dismiss();
      channel.postMessage({ type: "dismiss" });
      if (activeRequest) return;
      const request = (activeRequest = new AbortController());
      void browser.locks
        .request(activeLock, { mode: "shared", signal: request.signal }, async () => {
          if (request.signal.aborted) return;
          await new Promise<void>((resolve) => {
            releaseActive = resolve;
          });
        })
        .catch(() => {});
    } else {
      activeRequest?.abort();
      activeRequest = undefined;
      releaseActive?.();
      releaseActive = undefined;
    }
  }

  function acknowledge(event: RoomAlertEvent) {
    for (const [key, item] of pending) {
      if (item.event.stream === event.stream && item.event.sequence <= event.sequence)
        pending.delete(key);
    }
  }

  function enqueue(item: PendingAlert) {
    if (!owner) return;
    const request = ownerRequest;
    delivery = delivery
      .then(async () => {
        if (disposed || !owner || request !== ownerRequest) return;
        const saved = browser.read(`${prefix}:handled`);
        const last: RoomAlertEvent | undefined = saved ? JSON.parse(saved) : undefined;
        if (last?.stream === item.event.stream && last.sequence >= item.event.sequence) {
          acknowledge(last);
          channel?.postMessage({ type: "handled", event: last });
          return;
        }
        const locks = await browser.locks.query();
        if (disposed || !owner || request !== ownerRequest) return;
        refresh();
        const active = [...(locks.held ?? []), ...(locks.pending ?? [])].find((lock) =>
          lock.name?.startsWith(activePrefix),
        );
        const cueFor = item.viewed
          ? item.tabId
          : browser.active()
            ? tabId
            : active?.name?.slice(activePrefix.length);
        const expired = Date.now() - item.receivedAt > deliveryWindowMs;
        if (!cueFor && !expired && item.event.actor === options.username.value) {
          // A forwarded action may belong to this owner. Let the next tab
          // own delivery so both the banner and its click target are eligible.
          owner = false;
          dismiss();
          releaseOwner?.();
          releaseOwner = undefined;
          acquireOwner();
          return;
        }
        // Audio and native display share one consumed identity. A slower
        // tab must not play an app cue after this event made a native sound.
        browser.write(`${prefix}:handled`, JSON.stringify(item.event));
        acknowledge(item.event);
        channel?.postMessage({ type: "handled", event: item.event });
        if (expired || !notificationsEnabled.value || permission.value !== "granted") return;
        if (cueFor) {
          if (cueFor === tabId) options.playCue(item.kind);
          else
            channel?.postMessage({
              type: "cue",
              tabId: cueFor,
              kind: item.kind,
              receivedAt: item.receivedAt,
            });
          return;
        }
        dismiss();
        const update = item.kind === "newRound" ? "New round started" : "Votes revealed";
        // Safari was silent with omitted options in the native-audio comparison.
        // Explicitly allow sound; the browser and OS retain the final decision.
        notification = browser.show(`${options.roomId} — ${update}`, { silent: false }, () => {
          browser.focus();
          dismiss();
          channel?.postMessage({ type: "dismiss" });
        });
      })
      .catch(() => {
        error.value = "Desktop notification delivery failed. Check your browser's site settings.";
        dismiss();
      });
  }

  function acquireOwner() {
    const request = (ownerRequest = new AbortController());
    void browser.locks
      .request(`${prefix}:owner`, { signal: request.signal }, async () => {
        if (request.signal.aborted || disposed) return;
        owner = true;
        channel?.postMessage({ type: "ready" });
        for (const item of pending.values()) enqueue(item);
        await new Promise<void>((resolve) => {
          releaseOwner = resolve;
        });
        owner = false;
      })
      .catch(() => {
        if (!request.signal.aborted) {
          available.value = false;
          error.value =
            "This browser could not coordinate desktop notifications. Try reloading the room.";
        }
      });
  }

  function start() {
    if (!available.value || channel || disposed) return;
    try {
      channel = browser.channel(prefix);
      channel.onmessage = ({ data }) => {
        if (data?.type === "dismiss") dismiss();
        if (
          data?.type === "cue" &&
          data.tabId === tabId &&
          Date.now() - data.receivedAt <= deliveryWindowMs
        )
          options.playCue(data.kind);
        if (data?.type === "handled") acknowledge(data.event);
        if (data?.type === "ready")
          for (const item of pending.values()) channel?.postMessage({ type: "alert", ...item });
        if (data?.type === "alert") enqueue(data);
      };
      updateActivity();
      acquireOwner();
    } catch {
      available.value = false;
      error.value =
        "This browser could not coordinate desktop notifications. Try reloading the room.";
      stop();
    }
  }

  function stop() {
    channel?.postMessage({ type: "dismiss" });
    channel?.close();
    channel = undefined;
    ownerRequest?.abort();
    ownerRequest = undefined;
    activeRequest?.abort();
    activeRequest = undefined;
    releaseOwner?.();
    releaseOwner = undefined;
    releaseActive?.();
    releaseActive = undefined;
    owner = false;
    pending.clear();
    dismiss();
  }

  const unlisten = browser.listen(() => {
    refresh();
    updateActivity();
  });
  const unwatch = watch(
    options.connectionStatus,
    (status) => {
      if (status === "connected") start();
      else stop();
    },
    { immediate: true, flush: "sync" },
  );

  function alert(kind: RoomCue, event?: RoomAlertEvent) {
    if (disposed) return;
    refresh();
    if (
      !available.value ||
      !notificationsEnabled.value ||
      permission.value !== "granted" ||
      !event
    ) {
      options.playCue(kind);
      return;
    }
    if (options.connectionStatus.value !== "connected") return;
    const viewed = browser.active();
    if (event.actor === options.username.value && !viewed) return;
    const item = { kind, event, viewed, tabId, receivedAt: Date.now() };
    for (const [key, queued] of pending) {
      if (item.receivedAt - queued.receivedAt > deliveryWindowMs) pending.delete(key);
    }
    pending.set(`${event.stream}:${event.sequence}`, item);
    enqueue(item);
    channel?.postMessage({ type: "alert", ...item });
  }

  function dispose() {
    disposed = true;
    unwatch();
    unlisten();
    stop();
  }
  return {
    notificationsEnabled,
    notificationsUnavailable,
    notificationDescription,
    toggleNotifications,
    newRound: (event?: RoomAlertEvent) => alert("newRound", event),
    reveal: (event?: RoomAlertEvent) => alert("reveal", event),
    dispose,
  };
}
