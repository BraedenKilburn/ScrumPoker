<script setup lang="ts">
import { computed, useId } from "vue";
import { useAppearance, type ThemePreference } from "@/composables/useAppearance";

// Three-way segmented radiogroup for the theme preference. Binds straight
// to the appearance composable: the preference is device-wide, so it is
// not threaded through view props. Native radios give the same arrow-key
// semantics as the deck options in Settings.
const props = defineProps<{
  /** Icon-only segments (each keeps an accessible name); for tight spots like the navbar. */
  compact?: boolean;
  /** Id of the element naming the group; without it the group names itself "Appearance". */
  labelledby?: string;
  describedby?: string;
}>();

const { themePreference, setThemePreference } = useAppearance();
const selected = computed<ThemePreference>({
  get: () => themePreference.value,
  set: setThemePreference,
});
// Several controls can be mounted at once (navbar + Settings); each is its own radio group.
const name = useId();

const options: { id: ThemePreference; label: string; icon: string }[] = [
  { id: "system", label: "System", icon: "pi pi-desktop" },
  { id: "light", label: "Light", icon: "pi pi-sun" },
  { id: "dark", label: "Dark", icon: "pi pi-moon" },
];
// Drives the sliding selected-segment backing (see ::before below).
const selectedIndex = computed(() => options.findIndex((o) => o.id === selected.value));
</script>

<template>
  <div
    class="theme-preference"
    :class="{ compact }"
    :style="{ '--selected-index': selectedIndex }"
    role="radiogroup"
    :aria-label="props.labelledby ? undefined : 'Appearance'"
    :aria-labelledby="props.labelledby"
    :aria-describedby="props.describedby"
  >
    <label
      v-for="o in options"
      :key="o.id"
      class="segment"
      :class="{ selected: selected === o.id }"
      :title="compact ? o.label : undefined"
    >
      <input
        v-model="selected"
        type="radio"
        :name="name"
        :value="o.id"
        :aria-label="compact ? o.label : undefined"
      />
      <i :class="o.icon" aria-hidden="true" />
      <span v-if="!compact">{{ o.label }}</span>
    </label>
  </div>
</template>

<style scoped lang="scss">
.theme-preference {
  position: relative;
  display: grid;
  // Equal columns whether shrink-wrapped or stretched, so the backing
  // below can slide in exact thirds.
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  flex-shrink: 0;
  gap: 4px;
  padding: 4px;
  background: var(--surface-raised);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;

  // The selected segment's backing: one pill slid between segments
  // (same treatment as RoleToggle) rather than repainted per segment.
  &::before {
    content: "";
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 16px) / 3);
    border-radius: 0.5rem;
    background: var(--p-content-hover-background);
    box-shadow: 0 1px 4px rgb(var(--shadow-color) / 25%);
    transform: translateX(calc(var(--selected-index) * (100% + 4px)));
    transition: transform 0.2s ease;
    pointer-events: none;
  }
}

.segment {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 2.25rem;
  padding: 0 0.8rem;
  border-radius: 0.5rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;

  .pi {
    font-size: 0.85rem;
  }

  &:hover:not(.selected) {
    color: var(--p-text-color);
  }

  &.selected {
    color: var(--p-text-color);

    .pi {
      color: var(--p-primary-color);
    }
  }

  // The native radio does the work (checked state, arrow keys); the label
  // is its visible face, so keep the input in the label but off-screen.
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }

  &:has(input:focus-visible) {
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }
}

.compact .segment {
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
}
</style>
