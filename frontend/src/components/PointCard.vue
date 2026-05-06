<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value?: string;
    faceDown?: boolean;
    size?: "sm" | "md" | "lg";
    selected?: boolean;
    disabled?: boolean;
    interactive?: boolean;
  }>(),
  {
    size: "md",
    faceDown: false,
    selected: false,
    disabled: false,
    interactive: false,
  },
);

const colorBand = computed<"green" | "amber" | "red" | "violet">(() => {
  const v = props.value;
  if (v === "?" || v === "1" || v === "2") return "green";
  if (v === "3" || v === "5") return "amber";
  if (v === "8" || v === "13") return "red";
  return "violet";
});
</script>

<template>
  <div
    class="point-card"
    :class="[
      `size-${size}`,
      `band-${colorBand}`,
      {
        'face-down': faceDown,
        selected,
        disabled,
        interactive,
      },
    ]"
  >
    <template v-if="!faceDown">
      <span class="corner top-left">{{ value }}</span>
      <span class="value">{{ value }}</span>
      <span class="corner bottom-right">{{ value }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.point-card {
  --card-fg: #0a0a0a;
  --card-bg: var(--p-emerald-400);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  background: var(--card-bg);
  color: var(--card-fg);
  font-weight: 800;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  user-select: none;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 6px 18px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
  flex-shrink: 0;

  &.band-green {
    --card-bg: var(--p-emerald-400);
  }
  &.band-amber {
    --card-bg: var(--p-amber-400);
  }
  &.band-red {
    --card-bg: var(--p-red-400);
  }
  &.band-violet {
    --card-bg: var(--p-violet-400);
  }

  &.size-sm {
    width: 2.75rem;
    height: 3.75rem;
    font-size: 1.1rem;
    border-radius: 0.5rem;
    .corner {
      font-size: 0.55rem;
      padding: 0.2rem 0.3rem;
    }
  }
  &.size-md {
    width: 3.75rem;
    height: 5rem;
    font-size: 1.5rem;
    .corner {
      font-size: 0.65rem;
      padding: 0.25rem 0.4rem;
    }
  }
  &.size-lg {
    width: 4.5rem;
    height: 6rem;
    font-size: 1.85rem;
    .corner {
      font-size: 0.75rem;
      padding: 0.3rem 0.45rem;
    }
  }

  .value {
    line-height: 1;
  }

  .corner {
    position: absolute;
    line-height: 1;
    opacity: 0.85;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.6rem;

    &.top-left {
      top: 0;
      left: 0;
    }
    &.bottom-right {
      bottom: 0;
      right: 0;
      transform: rotate(180deg);
    }
  }

  &.face-down {
    background:
      repeating-linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.04) 0 6px,
        rgba(255, 255, 255, 0.01) 6px 12px
      ),
      color-mix(in srgb, var(--p-content-background) 80%, white 4%);
    border: 1px solid var(--p-content-border-color);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 4px 14px rgba(0, 0, 0, 0.35);
  }

  &.interactive {
    cursor: pointer;

    &:hover:not(.disabled) {
      transform: translateY(-3px);
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.12) inset,
        0 12px 28px rgba(0, 0, 0, 0.45);
    }
  }

  &.selected {
    transform: translateY(-6px);
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }

  &.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
</style>
