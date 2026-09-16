<script setup lang="ts">
import { ref, watch } from "vue";
import Dialog from "primevue/dialog";
import { decks, type DeckId } from "@shared/types";
import ThemePreferenceControl from "@/components/ThemePreferenceControl.vue";

const props = defineProps<{
  visible: boolean;
  isAdmin: boolean;
  currentDeck: DeckId;
  soundEnabled: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [visible: boolean];
  toggleSound: [];
  changeDeck: [deck: DeckId];
  afterHide: [];
}>();

const selectedDeck = ref(props.currentDeck);
const soundSwitch = ref<HTMLButtonElement | null>(null);

watch(
  () => [props.visible, props.currentDeck, props.isAdmin],
  () => {
    selectedDeck.value = props.currentDeck;
  },
);

// If admin controls disappear while focused, keep focus inside Settings.
watch(
  () => props.isAdmin,
  (isAdmin) => {
    if (props.visible && !isAdmin) soundSwitch.value?.focus();
  },
  { flush: "post" },
);

function updateDeck() {
  if (props.isAdmin && selectedDeck.value !== props.currentDeck) {
    emit("changeDeck", selectedDeck.value);
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Settings"
    modal
    :draggable="false"
    class="room-settings-dialog"
    @update:visible="emit('update:visible', $event)"
    @after-hide="emit('afterHide')"
  >
    <div class="sound-setting">
      <i class="pi pi-volume-up" aria-hidden="true" />
      <div class="setting-copy">
        <span id="settings-sound-label" class="setting-title">Sound</span>
        <p id="settings-sound-description">
          Play a chime when votes are revealed or a new round starts.
        </p>
      </div>
      <button
        ref="soundSwitch"
        type="button"
        class="sound-switch"
        role="switch"
        :aria-checked="soundEnabled"
        aria-labelledby="settings-sound-label"
        aria-describedby="settings-sound-description"
        autofocus
        @click="emit('toggleSound')"
      >
        <span aria-hidden="true" />
      </button>
    </div>

    <div class="appearance-setting">
      <i class="pi pi-palette" aria-hidden="true" />
      <div class="setting-copy">
        <span id="settings-appearance-label" class="setting-title">Appearance</span>
        <p id="settings-appearance-description">
          Follow your system setting, or choose light or dark.
        </p>
      </div>
      <ThemePreferenceControl
        labelledby="settings-appearance-label"
        describedby="settings-appearance-description"
      />
    </div>

    <form v-if="isAdmin" class="deck-settings" @submit.prevent="updateDeck">
      <fieldset>
        <legend><i class="pi pi-crown" aria-hidden="true" /> Change deck</legend>
        <div class="deck-options">
          <label
            v-for="option in decks"
            :key="option.id"
            class="deck-option"
            :class="{ selected: selectedDeck === option.id }"
          >
            <input v-model="selectedDeck" type="radio" name="settings-deck" :value="option.id" />
            <span class="deck-copy">
              <span class="deck-name">{{ option.label }}</span>
              <span class="deck-hint">{{ option.hint }}</span>
            </span>
            <span v-if="option.id === currentDeck" class="current">current</span>
          </label>
        </div>
      </fieldset>
      <p class="reset-hint">Changing the deck resets all votes.</p>
      <button class="update-deck" type="submit" :disabled="selectedDeck === currentDeck">
        Update deck
      </button>
    </form>
  </Dialog>
</template>

<style lang="scss">
.p-dialog.room-settings-dialog {
  width: min(34rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  border-radius: 1.4rem;

  .p-dialog-header {
    padding: 1.5rem 1.5rem 1rem;
  }

  .p-dialog-content {
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .p-dialog-title {
    font-size: 1.4rem;
    font-weight: 700;
  }
}
</style>

<style scoped lang="scss">
.sound-setting,
.appearance-setting {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 0.4rem 0 0.25rem;

  > .pi {
    margin-top: 0.25rem;
    color: var(--p-text-muted-color);
  }
}

.appearance-setting {
  margin-top: 0.75rem;
}

.setting-copy {
  flex: 1;
  min-width: 0;

  p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color);
    font-size: 0.9rem;
    line-height: 1.5;
  }
}

.setting-title,
legend {
  font-size: 1.05rem;
  font-weight: 600;
}

.sound-switch {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  width: 3.4rem;
  height: 2.75rem;
  padding: 0 0.3rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  position: relative;
  cursor: pointer;

  &::before {
    content: "";
    position: absolute;
    inset: 0.35rem 0;
    border: 1px solid var(--p-content-border-color);
    border-radius: inherit;
    background: var(--p-content-hover-background);
  }

  span {
    position: relative;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--p-text-muted-color);
  }

  &[aria-checked="true"] {
    &::before {
      border-color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 25%, var(--p-content-background));
    }

    span {
      margin-left: auto;
      background: var(--p-primary-color);
    }
  }
}

.deck-settings {
  margin-top: 1.4rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--p-content-border-color);
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

legend {
  padding: 0;
  margin-bottom: 0.85rem;

  .pi {
    color: var(--ink-amber);
    margin-right: 0.5rem;
    font-size: 0.85rem;
  }
}

.deck-options {
  display: grid;
  gap: 0.5rem;
}

.deck-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 2px solid var(--p-content-border-color);
  border-radius: 0.8rem;
  cursor: pointer;

  &.selected {
    border-color: var(--p-primary-color);
    background: color-mix(in srgb, var(--p-primary-color) 7%, var(--p-content-background));
  }

  &:has(input:focus-visible) {
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }

  input {
    flex-shrink: 0;
    margin: 0;
    width: 1.15rem;
    height: 1.15rem;
    accent-color: var(--p-primary-color);
  }
}

.deck-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.deck-name {
  font-weight: 600;
}

.deck-hint,
.current {
  color: var(--p-text-muted-color);
  font:
    0.8rem ui-monospace,
    monospace;
}

.current {
  font-size: 0.75rem;
}

.reset-hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  line-height: 1.5;
  margin: 0.85rem 0;
}

.update-deck {
  min-height: 2.9rem;
  padding: 0.65rem 1.2rem;
  border: none;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    background: var(--p-content-hover-background);
    color: var(--p-text-muted-color);
    opacity: 0.65;
    cursor: not-allowed;
  }
}

button:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 3px;
}

@media (max-width: 480px) {
  .appearance-setting {
    flex-wrap: wrap;

    .theme-preference {
      margin-left: 1.9rem;
    }
  }
}

@media (max-width: 380px) {
  .deck-option {
    flex-wrap: wrap;
  }

  .current {
    margin-left: 1.9rem;
  }
}
</style>
