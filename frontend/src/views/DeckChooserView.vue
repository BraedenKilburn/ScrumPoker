<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { decks, defaultDeckId, type DeckId } from "@shared/types";
import DeckOptionCard from "@/components/DeckOptionCard.vue";
import { useRecentRooms } from "@/composables/useRecentRooms";
import { checkRoom } from "@/modules/api";
import { useRootStore } from "@/stores/root";

const props = withDefaults(
  defineProps<{
    id: string;
    mode?: "create" | "change";
    currentDeck?: DeckId;
  }>(),
  {
    mode: "create",
    currentDeck: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [deck: DeckId];
}>();

const router = useRouter();
const store = useRootStore();
const { save: saveRecentRoom } = useRecentRooms();

const isCreate = computed(() => props.mode === "create");
const roomId = computed(() => props.id.toLowerCase());
const selected = ref<DeckId>(props.currentDeck ?? defaultDeckId);
const deckList = Object.values(decks);

const steps = [
  { id: "name", label: "Your name" },
  { id: "deck", label: "Choose deck" },
  { id: "room", label: "Room" },
];

onMounted(async () => {
  if (!isCreate.value) return;

  // The name step comes first — deep links / refreshes go back to Home.
  if (!store.username) {
    router.replace({ name: "Home" });
    return;
  }

  // Never show a deck picker whose choice can't apply: if the room now
  // exists (stale tab, race, deep link) skip straight into it. A failed
  // check (null) stays here — don't discard the pick over a network blip.
  const result = await checkRoom(roomId.value);
  if (result?.exists) {
    router.replace({ name: "Room", params: { id: roomId.value } });
  }
});

function goBack() {
  if (isCreate.value) router.push({ name: "Home" });
  else emit("close");
}

function confirm() {
  if (isCreate.value) {
    // Seed ourselves so the room doesn't first paint empty while the
    // socket handshake is in flight — same as HomeView's join path.
    store.addParticipant({
      username: store.username,
      point_estimate: undefined,
    });

    saveRecentRoom({
      id: roomId.value,
      username: store.username,
      joinedAt: Date.now(),
      deck: selected.value,
    });
    router.push({ name: "Room", params: { id: roomId.value }, query: { deck: selected.value } });
    return;
  }
  emit("confirm", selected.value);
}
</script>

<template>
  <div class="deck-chooser" :class="mode">
    <div class="top-bar">
      <button class="back-link" type="button" @click="goBack">
        <i class="pi pi-arrow-left" aria-hidden="true" />
        {{ isCreate ? "Home" : `Back to ${roomId.toUpperCase()}` }}
      </button>
      <div v-if="isCreate" class="steps" aria-hidden="true">
        <template v-for="(step, index) in steps" :key="step.id">
          <span v-if="index > 0" class="step-arrow">→</span>
          <span class="step" :class="{ current: step.id === 'deck' }">{{ step.label }}</span>
        </template>
      </div>
      <span v-else class="room-tag">{{ roomId.toUpperCase() }}</span>
      <span class="deck-count">{{ deckList.length }} decks</span>
    </div>

    <div class="chooser-header">
      <p class="overline">{{ isCreate ? "New room" : "Change estimation deck" }}</p>
      <h1>{{ isCreate ? "Choose your deck" : "Pick a new deck" }}</h1>
      <p v-if="isCreate" class="subtitle">
        Everyone in the room votes on this scale. You can change it later from inside the room.
      </p>
      <p v-else class="subtitle warning">
        <i class="pi pi-exclamation-triangle" aria-hidden="true" />
        Changing the deck clears the current round's votes.
      </p>
    </div>

    <div class="deck-grid" role="radiogroup" aria-label="Estimation deck">
      <DeckOptionCard
        v-for="deck in deckList"
        :key="deck.id"
        :deck="deck"
        :selected="selected === deck.id"
        @select="selected = deck.id"
      />
    </div>

    <div class="footer-cta">
      <span class="selected-label">
        Selected · <strong>{{ decks[selected].label }}</strong>
      </span>
      <button class="cta" type="button" @click="confirm">
        {{ isCreate ? `Create ${roomId.toUpperCase()}` : "Update deck" }}
        <i class="pi pi-chevron-right" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.deck-chooser {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--nav-height) - var(--footer-height));
  background: var(--p-content-background);
  color: var(--p-text-color);

  &.change {
    min-height: 100%;
  }
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem clamp(1.25rem, 3vw, 2rem);
  border-bottom: 1px solid var(--p-content-border-color);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;

  &:hover {
    color: var(--p-text-color);
  }

  .pi {
    font-size: 0.8rem;
  }
}

.steps {
  display: none;
  align-items: center;
  gap: 0.6rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  @media (min-width: 768px) {
    display: flex;
  }

  .step {
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    color: var(--p-text-muted-color);

    &.current {
      color: var(--p-primary-color);
      font-weight: 600;
    }
  }

  .step-arrow {
    color: var(--p-text-muted-color);
    font-size: 0.75rem;
  }
}

.room-tag {
  display: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);

  @media (min-width: 768px) {
    display: inline;
  }
}

.deck-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.chooser-header {
  padding: clamp(1.25rem, 3vw, 1.75rem) clamp(1.25rem, 3vw, 2rem) 0.5rem;

  .overline {
    margin: 0 0 0.4rem;
    font-size: 0.7rem;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.65rem, 4vw, 2.15rem);
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .subtitle {
    margin: 0.5rem 0 0;
    max-width: 35rem;
    font-size: 0.95rem;
    color: var(--p-text-muted-color);
    line-height: 1.5;
  }

  .warning {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--p-amber-400);
  }
}

.deck-grid {
  flex: 1;
  display: grid;
  /* minmax(0, 1fr): a bare 1fr track can't shrink below the fan's
     natural min-content width, blowing the grid past the viewport */
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: 1fr;
  gap: 0.85rem;
  padding: 1.1rem clamp(1.25rem, 3vw, 2rem) 1.5rem;
  box-sizing: border-box;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
}

.footer-cta {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem clamp(1.25rem, 3vw, 2rem) calc(1rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);

  .selected-label {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);

    strong {
      color: var(--p-text-color);
      font-weight: 600;
    }
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 3.1rem;
    padding: 0 1.6rem;
    border: none;
    border-radius: 0.8rem;
    background: linear-gradient(110deg, var(--p-primary-color), var(--p-green-400));
    color: var(--p-primary-contrast-color);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;

    .pi {
      font-size: 0.8rem;
    }
  }
}
</style>
