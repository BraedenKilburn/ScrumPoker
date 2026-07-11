<script setup lang="ts">
import type { RoomReaction } from "@/composables/useReactions";

defineProps<{ items: RoomReaction[] }>();
</script>

<template>
  <section class="reaction-feed surface-panel" aria-label="Recent reactions">
    <TransitionGroup tag="ol" name="reaction-feed" aria-live="polite" aria-relevant="additions">
      <li v-for="item in items" :key="item.id">
        <span class="emoji" aria-hidden="true">{{ item.emoji }}</span>
        <span class="message"
          ><strong>{{ item.who }}</strong> reacted</span
        >
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped lang="scss">
.reaction-feed {
  padding: 0.75rem 1rem;
  overflow: hidden;

  ol {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    font-size: 0.8rem;
  }

  .emoji {
    flex: 0 0 auto;
    font-size: 1rem;
    line-height: 1;
  }

  .message {
    overflow: hidden;
    color: var(--p-text-muted-color);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--p-text-color);
    font-weight: 600;
  }
}

.reaction-feed-enter-active,
.reaction-feed-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.reaction-feed-enter-from {
  opacity: 0;
  transform: translateY(-0.35rem);
}

.reaction-feed-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
</style>
