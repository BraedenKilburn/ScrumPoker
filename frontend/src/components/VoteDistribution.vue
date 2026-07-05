<script setup lang="ts">
import { computed } from "vue";
import { deckScale, deckTone, toneColor, type CardTone } from "@/modules/deckTone";
import type { RoomMember } from "@/modules/roomMembers";

const props = defineProps<{ members: RoomMember[]; cards: readonly string[] }>();

const numericVotes = computed(() =>
  props.members
    .map((m) => m.point)
    .filter((p): p is string => p != null)
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n)),
);

const buckets = computed(() => {
  const counts = new Map<string, number>();
  for (const m of props.members) {
    if (m.point == null) continue;
    counts.set(m.point, (counts.get(m.point) ?? 0) + 1);
  }
  return props.cards.filter((v) => counts.has(v)).map((v) => ({ value: v, count: counts.get(v)! }));
});

const maxCount = computed(() => Math.max(1, ...buckets.value.map((b) => b.count)));

const avg = computed(() => {
  if (!numericVotes.value.length) return null;
  const sum = numericVotes.value.reduce((a, b) => a + b, 0);
  return Math.round((sum / numericVotes.value.length) * 10) / 10;
});

const median = computed(() => {
  if (!numericVotes.value.length) return null;
  const sorted = [...numericVotes.value].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
});

// All votes count toward n; avg/med stay "—" for non-numeric decks.
const n = computed(() => props.members.filter((m) => m.point != null).length);

// Bars use the card's tone so the chart matches the hand. Cards that
// share a tone (e.g. 5 and 8 are both amber) fade in within their
// group — lighter = smaller, solid = the group's biggest — so adjacent
// same-tone columns still read apart at a glance. Derived solely from
// the deck, so it's computed once per deck change rather than per bar.
const MIN_GROUP_ALPHA = 55;

const cardColors = computed(() => {
  const groups = new Map<CardTone, string[]>();
  for (const card of deckScale(props.cards)) {
    const tone = deckTone(card, props.cards);
    groups.set(tone, [...(groups.get(tone) ?? []), card]);
  }

  const colors = new Map<string, { bar: string; label: string }>();
  for (const card of props.cards) {
    const tone = deckTone(card, props.cards);
    const solid = toneColor(tone);
    const group = groups.get(tone) ?? [];
    const index = group.indexOf(card);
    const alpha =
      index < 0 || group.length === 1
        ? 100
        : Math.round(MIN_GROUP_ALPHA + ((100 - MIN_GROUP_ALPHA) * index) / (group.length - 1));
    const bar = alpha === 100 ? solid : `color-mix(in srgb, ${solid} ${alpha}%, transparent)`;
    colors.set(card, { bar, label: solid });
  }
  return colors;
});
</script>

<template>
  <aside class="distribution surface-panel">
    <header>
      <h3 class="title">Distribution</h3>
      <div class="stats">
        <span><em>avg</em> {{ avg ?? "—" }}</span>
        <span><em>med</em> {{ median ?? "—" }}</span>
        <span><em>n</em> {{ n }}</span>
      </div>
    </header>

    <div v-if="buckets.length" class="chart">
      <div v-for="b in buckets" :key="b.value" class="col">
        <span class="count">{{ b.count }}</span>
        <div class="bar-track">
          <div
            class="bar"
            :style="{
              height: `${(b.count / maxCount) * 100}%`,
              background: cardColors.get(b.value)?.bar,
            }"
          />
        </div>
        <span class="label" :style="{ color: cardColors.get(b.value)?.label }">{{ b.value }}</span>
      </div>
    </div>
    <p v-else class="empty">No votes yet</p>
  </aside>
</template>

<style scoped lang="scss">
.distribution {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .title {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--p-text-muted-color);
  }

  .stats {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    font-weight: 700;

    em {
      font-style: normal;
      color: var(--p-text-muted-color);
      font-weight: 400;
      margin-right: 0.25rem;
      font-size: 0.75rem;
    }
  }

  .chart {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 8rem;
  }

  .col {
    flex: 1 1 0;
    min-width: 1.5rem;
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-items: stretch;
    gap: 0.25rem;
    height: 100%;

    .count {
      justify-self: center;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }

    .bar-track {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      align-items: flex-end;
    }

    .bar {
      width: 100%;
      min-height: 6px;
      border-radius: 0.4rem;
      transition: height 0.3s ease;
    }

    .label {
      justify-self: center;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: ui-monospace, monospace;
    }
  }

  .empty {
    margin: 0;
    color: var(--p-text-muted-color);
    font-size: 0.85rem;
  }
}
</style>
