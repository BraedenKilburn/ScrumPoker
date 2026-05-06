<script setup lang="ts">
import PointCard from "@/components/PointCard.vue";

const props = defineProps<{
  points: readonly string[];
  current?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  vote: [point: string];
  clear: [];
}>();

function pick(p: string) {
  if (props.disabled) return;
  emit("vote", p);
}
</script>

<template>
  <div class="hand-strip surface-panel">
    <div class="meta">
      <span class="label">Your hand</span>
      <span class="value-slot">
        <Transition name="hand-value" mode="out-in">
          <span :key="current ?? 'empty'" class="value">{{ current ?? "—" }}</span>
        </Transition>
      </span>
    </div>
    <div class="cards" role="list">
      <button
        v-for="p in points"
        :key="p"
        class="card-btn"
        :disabled="disabled"
        :aria-label="`Vote ${p}`"
        @click="pick(p)"
      >
        <PointCard
          :value="p"
          size="md"
          :selected="current === p"
          :disabled="disabled"
          interactive
        />
      </button>
    </div>
    <button class="clear" :disabled="!current || disabled" @click="emit('clear')">Clear</button>
  </div>
</template>

<style scoped lang="scss">
.hand-strip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 5rem;

  .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--p-text-muted-color);
  }
  .value-slot {
    display: block;
    min-height: 1.95rem;
    min-width: 2.5rem;
    overflow: hidden;
  }

  .value {
    display: inline-block;
    font-size: 1.75rem;
    font-weight: 800;
    font-family: ui-monospace, monospace;
    line-height: 1;
  }
}

.cards {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  overflow-x: auto;
  overflow-y: visible;
  scroll-snap-type: x mandatory;
  padding: 0.85rem 0.25rem;
  margin: -0.85rem 0;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--p-content-border-color);
    border-radius: 3px;
  }
}

.card-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  scroll-snap-align: start;

  &:disabled {
    cursor: not-allowed;
  }
}

.clear {
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--p-text-color);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

@media (max-width: 640px) {
  .hand-strip {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "meta clear"
      "cards cards";
    row-gap: 0.6rem;
    padding: 0.65rem 0.75rem;
  }
  .meta {
    grid-area: meta;

    .value {
      font-size: 1.4rem;
    }

    .value-slot {
      min-height: 1.55rem;
    }
  }
  .clear {
    grid-area: clear;
    justify-self: end;
  }
  .cards {
    grid-area: cards;
    gap: 0.4rem;

    :deep(.point-card.size-md) {
      width: 2.6rem;
      height: 3.6rem;
      font-size: 1.05rem;
      border-radius: 0.5rem;

      .corner {
        font-size: 0.5rem;
        padding: 0.18rem 0.28rem;
      }
    }
  }
}

.hand-value-enter-active,
.hand-value-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.hand-value-enter-from {
  opacity: 0;
  transform: translateY(0.3rem) scale(0.96);
}

.hand-value-leave-to {
  opacity: 0;
  transform: translateY(-0.3rem) scale(0.98);
}
</style>
