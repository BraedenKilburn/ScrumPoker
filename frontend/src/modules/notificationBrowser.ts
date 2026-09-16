/** Browser boundaries used by room notifications, injectable without replacing app code. */
export interface NotificationBrowser {
  supported: boolean;
  active(): boolean;
  focus(): void;
  show(title: string, options: NotificationOptions, click: () => void): { close(): void };
  channel(name: string): Pick<BroadcastChannel, "postMessage" | "close" | "onmessage">;
  locks: Pick<LockManager, "request" | "query">;
  read(key: string): string | null;
  write(key: string, value: string): void;
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  listen(callback: () => void): () => void;
}

export function createNotificationBrowser(): NotificationBrowser {
  return {
    supported:
      typeof Notification !== "undefined" &&
      globalThis.isSecureContext === true &&
      typeof BroadcastChannel !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.locks,
    active: () => document.visibilityState === "visible" && document.hasFocus(),
    focus: () => window.focus(),
    show: (title, options, click) => {
      const notification = new Notification(title, options);
      notification.onclick = click;
      return notification;
    },
    channel: (name) => new BroadcastChannel(name),
    locks: typeof navigator === "undefined" ? undefined! : navigator.locks,
    read: (key) => localStorage.getItem(key),
    write: (key, value) => localStorage.setItem(key, value),
    permission: () => (typeof Notification === "undefined" ? "denied" : Notification.permission),
    requestPermission: () => Notification.requestPermission(),
    listen: (callback) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("focus", callback);
      window.addEventListener("blur", callback);
      document.addEventListener("visibilitychange", callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener("focus", callback);
        window.removeEventListener("blur", callback);
        document.removeEventListener("visibilitychange", callback);
        window.removeEventListener("storage", callback);
      };
    },
  };
}
