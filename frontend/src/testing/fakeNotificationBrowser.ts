import type { NotificationBrowser } from "@/modules/notificationBrowser";

/** Same-origin browser facilities shared by simulated tabs. */
export function notificationBrowserFamily() {
  const values = new Map<string, string>();
  const channels = new Map<string, Set<BroadcastChannel>>();
  type Request = {
    name: string;
    mode: LockMode;
    signal?: AbortSignal;
    run: () => Promise<void>;
    reject: (reason: unknown) => void;
  };
  const held = new Set<Request>();
  const pending: Request[] = [];
  function drain() {
    // Iterate a snapshot because granting a request removes it from the queue.
    for (const request of pending.slice()) {
      if (
        [...held].some(
          (h) =>
            h.name === request.name && (h.mode === "exclusive" || request.mode === "exclusive"),
        )
      )
        continue;
      pending.splice(pending.indexOf(request), 1);
      held.add(request);
      void request.run().finally(() => {
        held.delete(request);
        drain();
      });
    }
  }
  const locks = {
    request(name: string, options: LockOptions, callback: () => Promise<void>) {
      return new Promise<void>((resolve, reject) => {
        const request: Request = {
          name,
          mode: options.mode ?? "exclusive",
          signal: options.signal,
          reject,
          run: async () => {
            try {
              await callback();
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        };
        if (options.signal?.aborted) {
          reject(new Error("aborted"));
          return;
        }
        options.signal?.addEventListener("abort", () => {
          const index = pending.indexOf(request);
          if (index >= 0) {
            pending.splice(index, 1);
            reject(new Error("aborted"));
          }
        });
        pending.push(request);
        queueMicrotask(drain);
      });
    },
    async query() {
      return {
        held: [...held].map((r) => ({ name: r.name, mode: r.mode })),
        pending: pending.map((r) => ({ name: r.name, mode: r.mode })),
      };
    },
  } as unknown as Pick<LockManager, "request" | "query">;
  function tab() {
    let active = false;
    let permission: NotificationPermission = "granted";
    let listener: (() => void) | undefined;
    const shown: {
      title: string;
      options: NotificationOptions;
      closed: boolean;
      click: () => void;
    }[] = [];
    let focusCount = 0;
    const browser: NotificationBrowser = {
      supported: true,
      read: (key) => values.get(key) ?? null,
      write: (key, value) => {
        values.set(key, value);
      },
      permission: () => permission,
      requestPermission: async () => permission,
      listen: (callback) => {
        listener = callback;
        return () => {
          listener = undefined;
        };
      },
      active: () => active,
      focus: () => {
        focusCount++;
        active = true;
        listener?.();
      },
      locks,
      channel(name) {
        const peers = channels.get(name) ?? new Set<BroadcastChannel>();
        channels.set(name, peers);
        const channel = {
          onmessage: null,
          postMessage(data: unknown) {
            for (const peer of peers)
              if (peer !== channel)
                queueMicrotask(() => {
                  if (peers.has(peer)) peer.onmessage?.({ data } as MessageEvent);
                });
          },
          close() {
            peers.delete(channel as BroadcastChannel);
          },
        } as BroadcastChannel;
        peers.add(channel);
        return channel;
      },
      show(title, options, click) {
        const item = { title, options, closed: false, click };
        shown.push(item);
        return {
          close: () => {
            item.closed = true;
          },
        };
      },
    };
    const result = {
      browser,
      shown,
      setActive(value: boolean) {
        active = value;
        listener?.();
      },
      setPermission(value: NotificationPermission) {
        permission = value;
        listener?.();
      },
      get focusCount() {
        return focusCount;
      },
    };
    return result;
  }
  return { tab, values };
}

export async function settleNotifications() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}
