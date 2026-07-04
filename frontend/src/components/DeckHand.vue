<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PointCard from "@/components/PointCard.vue";
import { deckTone } from "@/modules/deckTone";

const props = withDefaults(
  defineProps<{
    cards: readonly string[];
    size?: "sm" | "md";
    /** Clamp the fan's width so big decks overlap into a tidy hand. */
    maxWidth?: number;
    /** Grow/shrink the fan to fill the surrounding container. */
    fit?: boolean;
  }>(),
  {
    size: "md",
    maxWidth: undefined,
    fit: false,
  },
);

// Card dims match PointCard's sm (2.75×3.75rem) and md (3.75×5rem) sizes.
const dims = computed(() =>
  props.size === "sm" ? { w: 44, h: 60, gap: 30, lift: 10 } : { w: 60, h: 80, gap: 42, lift: 16 },
);

// In fit mode the fan scales to the container's height (so card size
// tracks the space available) while the gap tightens so the scaled fan
// also fits the container's width — bigger decks overlap more instead
// of shrinking their cards.
const MAX_FIT_SCALE = 2;
const MIN_GAP = 8;
const fitBox = ref<HTMLElement>();
const fitScale = ref(1);
const fitWidth = ref(0);

const scale = computed(() => (props.fit ? fitScale.value : 1));

const span = computed(() => Math.min(34, Math.max(8, props.cards.length * 4.5)));
const mid = computed(() => (props.cards.length - 1) / 2);

// The fan's true visual bounds include the rotated corners of the outer
// cards — sizing by the unrotated card boxes lets those corners bleed
// out of the container.
const thetaMax = computed(() => (span.value / 2) * (Math.PI / 180));

/** Horizontal reach of the outermost (most rotated) card beyond its pivot. */
const edgeExtentX = computed(
  () => (dims.value.w / 2) * Math.cos(thetaMax.value) + dims.value.h * Math.sin(thetaMax.value),
);

const gap = computed(() => {
  const n = props.cards.length;
  if (n <= 1) return dims.value.gap;
  const widthBudget = props.fit ? fitWidth.value / scale.value : props.maxWidth;
  if (!widthBudget) return dims.value.gap;
  const maxGap = (widthBudget / 2 - 1 - edgeExtentX.value) / mid.value;
  return Math.max(MIN_GAP, Math.min(dims.value.gap, maxGap));
});

const fanWidth = computed(() => 2 * (mid.value * gap.value + edgeExtentX.value) + 2);

const fanHeight = computed(() => {
  const { w, h, lift } = dims.value;
  const arcMax = Math.min(mid.value, 1) * lift;
  const cornerDrop = (w / 2) * Math.sin(thetaMax.value);
  return lift + arcMax + h + cornerDrop + 2;
});

function cardStyle(index: number) {
  const n = props.cards.length;
  const rot = n === 1 ? 0 : -span.value / 2 + (span.value * index) / (n - 1);
  const arc = Math.abs(index - mid.value) * (dims.value.lift / Math.max(mid.value, 1));
  return {
    left: "50%",
    top: `${dims.value.lift}px`,
    transform: `translateX(calc(-50% + ${(index - mid.value) * gap.value}px)) translateY(${arc}px) rotate(${rot}deg)`,
    zIndex: index,
  };
}

function updateFit() {
  const box = fitBox.value;
  if (!box || !box.clientWidth || !box.clientHeight) return;
  fitScale.value = Math.min(box.clientHeight / fanHeight.value, MAX_FIT_SCALE);
  fitWidth.value = box.clientWidth;
}

let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!props.fit || !fitBox.value) return;
  observer = new ResizeObserver(updateFit);
  observer.observe(fitBox.value);
  updateFit();
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div v-if="cards.length" ref="fitBox" class="hand-box" :class="{ fit }">
    <div
      class="deck-hand"
      :style="{
        height: `${fanHeight}px`,
        width: `${fanWidth}px`,
        transform: fit ? `scale(${scale})` : undefined,
      }"
    >
      <div v-for="(card, index) in cards" :key="card" class="fan-card" :style="cardStyle(index)">
        <PointCard :value="card" :band="deckTone(card, cards)" :size="size" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hand-box {
  display: flex;
  align-items: center;
  justify-content: center;

  &.fit {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
  }
}

.deck-hand {
  position: relative;
  flex-shrink: 0;
  /* Contain the fan cards' z-indexes so they can't paint over
     sibling UI (e.g. the chooser's sticky footer CTA). */
  isolation: isolate;
}

.fan-card {
  position: absolute;
  transform-origin: bottom center;
}
</style>
