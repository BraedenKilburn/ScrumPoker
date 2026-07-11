<script setup lang="ts">
import { reactionEmojis, type ReactionEmoji } from "@shared/types";

withDefaults(defineProps<{ disabled?: boolean; rateLimited?: boolean }>(), {
  disabled: false,
  rateLimited: false,
});

const emit = defineEmits<{
  react: [emoji: ReactionEmoji];
}>();

const labels: Record<ReactionEmoji, string> = {
  "👍": "thumbs up",
  "🎉": "celebrate",
  "🤔": "thinking",
  "👀": "eyes",
  "⏳": "hourglass",
  "☕": "coffee break",
};
</script>

<template>
  <section class="reaction-bar surface-panel" aria-label="Reactions">
    <div class="heading">
      <h3 class="panel-title">Reactions</h3>
      <span class="rate-limit-status" role="status" aria-live="polite" aria-atomic="true">
        {{ rateLimited ? "Take a beat…" : "" }}
      </span>
    </div>
    <div class="picker">
      <button
        v-for="emoji in reactionEmojis"
        :key="emoji"
        type="button"
        :aria-label="`React with ${labels[emoji]}`"
        :title="labels[emoji]"
        :disabled="disabled"
        @click="emit('react', emoji)"
      >
        <span aria-hidden="true">{{ emoji }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.reaction-bar {
  padding: 1rem;

  .heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .rate-limit-status {
    min-height: 1em;
    color: var(--p-amber-400);
    font-size: 0.7rem;
    line-height: 1;
    white-space: nowrap;
  }
}

.picker {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.35rem;

  button {
    display: grid;
    min-width: 0;
    min-height: 2.5rem;
    place-items: center;
    padding: 0;
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--p-content-background) 72%, white 4%);
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 1.15rem;
    line-height: 1;
    touch-action: manipulation;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;

    &:hover:not(:disabled),
    &:focus-visible {
      border-color: color-mix(in srgb, var(--p-primary-color) 70%, white);
      background: color-mix(in srgb, var(--p-primary-color) 14%, var(--p-content-background));
      transform: translateY(-2px);
    }

    &:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 2px;
    }

    &:active:not(:disabled) {
      transform: translateY(0) scale(0.92);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }
}
</style>
