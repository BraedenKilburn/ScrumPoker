<script setup lang="ts">
import { computed } from "vue";
import type { RoomMember } from "@/modules/roomMembers";
import { pointValues } from "@/modules/roomMembers";

const props = defineProps<{ members: RoomMember[] }>();

const numericVotes = computed(() =>
  props.members
    .map((m) => m.point)
    .filter((p): p is string => p != null && p !== "?")
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n)),
);

const buckets = computed(() => {
  const counts = new Map<string, number>();
  for (const m of props.members) {
    if (m.point == null) continue;
    counts.set(m.point, (counts.get(m.point) ?? 0) + 1);
  }
  return pointValues.filter((v) => counts.has(v)).map((v) => ({ value: v, count: counts.get(v)! }));
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

const n = computed(() => numericVotes.value.length);

function bandFor(value: string): "green" | "amber" | "red" | "violet" {
  if (value === "?" || value === "1" || value === "2") return "green";
  if (value === "3" || value === "5") return "amber";
  if (value === "8" || value === "13") return "red";
  return "violet";
}
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
        <div
          class="bar"
          :class="`band-${bandFor(b.value)}`"
          :style="{ height: `${(b.count / maxCount) * 100}%` }"
        />
        <span class="label">{{ b.value }}</span>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    height: 100%;

    .count {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }

    .bar {
      width: 100%;
      min-height: 6px;
      border-radius: 0.4rem;
      background: var(--p-emerald-400);
      transition: height 0.3s ease;

      &.band-green {
        background: var(--p-emerald-400);
      }
      &.band-amber {
        background: var(--p-amber-400);
      }
      &.band-red {
        background: var(--p-red-400);
      }
      &.band-violet {
        background: var(--p-violet-400);
      }
    }

    .label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--p-text-color);
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
