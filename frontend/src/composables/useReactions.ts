import { computed, ref, type Ref } from "vue";
import type { ReactionEmoji } from "@shared/types";
import { sendReaction as sendReactionMessage, type ConnectionStatus } from "@/modules/socket";

export type RoomReaction = {
  id: number;
  emoji: ReactionEmoji;
  who: string;
  x: number;
};

const BURST_LIFETIME_MS = 1800;
const FEED_LIFETIME_MS = 5000;
const MAX_FEED_ITEMS = 4;
const MAX_VISIBLE_BURSTS = 12;

/**
 * Feature composable hanging off the room session (the template for the
 * pattern — see AGENTS.md). It owns all reaction UI state and receives
 * session state as refs; the session's message switch stays the single
 * mapping from server messages to behavior and calls the plain methods
 * exposed here (`show`, `applyRateLimit`, `clearRateLimit`, `dispose`)
 * rather than forwarding raw messages in.
 */
export function useReactions(session: {
  username: Ref<string>;
  connectionStatus: Ref<ConnectionStatus>;
}) {
  const reactionBursts = ref<RoomReaction[]>([]);
  const reactionFeed = ref<RoomReaction[]>([]);
  const reactionsRateLimited = ref(false);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let rateLimitTimer: ReturnType<typeof setTimeout> | undefined;
  let nextReactionId = 0;

  const canReact = computed(
    () => session.connectionStatus.value === "connected" && !reactionsRateLimited.value,
  );

  function scheduleCleanup(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function clearRateLimit() {
    if (rateLimitTimer) clearTimeout(rateLimitTimer);
    rateLimitTimer = undefined;
    reactionsRateLimited.value = false;
  }

  function applyRateLimit(retryAfterMs: number) {
    clearRateLimit();
    const delay = Math.max(0, Math.ceil(retryAfterMs));
    if (delay === 0) return;

    reactionsRateLimited.value = true;
    rateLimitTimer = setTimeout(() => {
      rateLimitTimer = undefined;
      reactionsRateLimited.value = false;
    }, delay);
  }

  function show(emoji: ReactionEmoji, reactingUsername: string) {
    const PADDING_PERCENTAGE = 10;

    const reaction: RoomReaction = {
      id: ++nextReactionId,
      emoji,
      who: reactingUsername === session.username.value ? "You" : reactingUsername,
      x: PADDING_PERCENTAGE + Math.random() * (100 - 2 * PADDING_PERCENTAGE),
    };

    reactionBursts.value = [...reactionBursts.value, reaction].slice(-MAX_VISIBLE_BURSTS);
    reactionFeed.value = [reaction, ...reactionFeed.value].slice(0, MAX_FEED_ITEMS);

    scheduleCleanup(() => {
      reactionBursts.value = reactionBursts.value.filter((item) => item.id !== reaction.id);
    }, BURST_LIFETIME_MS);
    scheduleCleanup(() => {
      reactionFeed.value = reactionFeed.value.filter((item) => item.id !== reaction.id);
    }, FEED_LIFETIME_MS);
  }

  function sendReaction(emoji: ReactionEmoji) {
    if (!canReact.value) return;
    sendReactionMessage(emoji);
  }

  function dispose() {
    clearRateLimit();
    timers.forEach(clearTimeout);
    timers.clear();
    reactionBursts.value = [];
    reactionFeed.value = [];
  }

  return {
    canReact,
    reactionBursts,
    reactionFeed,
    reactionsRateLimited,
    applyRateLimit,
    clearRateLimit,
    dispose,
    sendReaction,
    show,
  };
}
