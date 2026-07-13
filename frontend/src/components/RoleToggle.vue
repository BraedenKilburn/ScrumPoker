<script setup lang="ts">
import type { ParticipantRole } from "@shared/types";

// Two-way segmented control, not a checkbox, so "which one am I" always
// reads at a glance. Shared by the home form and the room's join dialog.
const role = defineModel<ParticipantRole>({ required: true });

const options = [
  { id: "voter", label: "Voting", icon: "pi pi-clone" },
  { id: "spectator", label: "Spectating", icon: "pi pi-eye" },
] as const;
</script>

<template>
  <div
    class="role-toggle"
    :class="{ 'spectator-active': role === 'spectator' }"
    role="radiogroup"
    aria-label="Join as"
  >
    <button
      v-for="o in options"
      :key="o.id"
      type="button"
      class="option"
      :class="[o.id, { active: role === o.id }]"
      role="radio"
      :aria-checked="role === o.id"
      @click="role = o.id"
    >
      <i :class="o.icon" aria-hidden="true" />
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.role-toggle {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: color-mix(in srgb, var(--p-content-background) 70%, black);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;

  &::before {
    content: "";
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 12px) / 2);
    border-radius: 0.5rem;
    background: var(--p-content-hover-background);
    box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
    pointer-events: none;
    transition: transform 0.2s ease;
  }

  &.spectator-active::before {
    transform: translateX(calc(100% + 4px));
  }

  .option {
    position: relative;
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 2.5rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--p-text-muted-color);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease;

    .pi {
      font-size: 0.8rem;
    }

    &:hover:not(.active) {
      color: var(--p-text-color);
    }

    &.active {
      color: var(--p-text-color);
    }

    &.voter.active .pi {
      color: var(--p-primary-color);
    }

    &.spectator.active .pi {
      color: var(--p-violet-400);
    }
  }
}
</style>
