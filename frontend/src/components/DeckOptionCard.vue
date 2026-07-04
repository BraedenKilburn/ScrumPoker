<script setup lang="ts">
import type { Deck } from "@shared/types";
import DeckHand from "@/components/DeckHand.vue";

const props = defineProps<{
  deck: Deck;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const inputId = `deck-option-${props.deck.id}`;
</script>

<template>
  <label class="deck-option" :class="{ selected }" :for="inputId">
    <input
      :id="inputId"
      class="radio-input"
      type="radio"
      name="deck"
      :value="deck.id"
      :checked="selected"
      @change="emit('select')"
    />
    <div class="option-header">
      <span class="radio-bullet" aria-hidden="true" />
      <div class="option-meta">
        <span class="label">{{ deck.label }}</span>
        <span class="hint">{{ deck.hint }}</span>
      </div>
      <span class="count">{{ deck.cards.length }} cards</span>
    </div>
    <div class="hand-slot">
      <DeckHand :cards="deck.cards" size="md" fit />
    </div>
  </label>
</template>

<style scoped lang="scss">
.deck-option {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: clip;
  padding: 1.1rem 1.25rem;
  border: 1.5px solid var(--p-content-border-color);
  border-radius: 1rem;
  background: var(--p-content-background);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--p-primary-color) 50%, var(--p-content-border-color));
  }

  &.selected {
    border-color: var(--p-primary-color);
    background: color-mix(in srgb, var(--p-primary-color) 9%, var(--p-content-background));
  }

  &:has(.radio-input:focus-visible) {
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }
}

.radio-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}

.option-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.radio-bullet {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.1rem;
  border: 2px solid var(--p-content-border-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.14s ease;

  &::after {
    content: "";
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--p-primary-color);
    transform: scale(0);
    transition: transform 0.14s ease;
  }

  .deck-option.selected & {
    border-color: var(--p-primary-color);

    &::after {
      transform: scale(1);
    }
  }
}

.option-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  .label {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--p-text-color);
    letter-spacing: -0.01em;
  }

  .hint {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
}

.count {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hand-slot {
  flex: 1;
  display: flex;
  min-height: 6rem;
}
</style>
