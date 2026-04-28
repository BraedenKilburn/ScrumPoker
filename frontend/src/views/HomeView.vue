<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import type { RecentRoom } from "@/composables/useRecentRooms";
import { useRecentRooms } from "@/composables/useRecentRooms";
import { usernameKey } from "@/modules/constants";
import { useRootStore } from "@/stores/root";

const CARD_VALUES = ["8", "5", "3", "13", "21"] as const;

const username = ref(localStorage.getItem(usernameKey) ?? "");
const roomId = ref("");

const store = useRootStore();
const router = useRouter();
const { rooms: recentRooms, save: saveRecentRoom, clear: clearRecentRooms } = useRecentRooms();

function generateRoomId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

function join(recentRoomId?: string) {
  if (!username.value) return;

  const requestedRoomId = recentRoomId ?? roomId.value.trim();
  const nextRoomId = (requestedRoomId || generateRoomId()).toLowerCase();

  store.setUsername(username.value);
  store.addParticipant({
    username: username.value,
    point_estimate: undefined,
  });

  saveRecentRoom({
    id: nextRoomId,
    username: username.value,
    joinedAt: Date.now(),
  });

  router.push({ name: "Room", params: { id: nextRoomId } });
}

function useRecentRoom(recentRoom: RecentRoom) {
  if (!username.value) username.value = recentRoom.username;
  if (!username.value) return;

  join(recentRoom.id);
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const relativeTimeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatJoinedAt(joinedAt: number) {
  const elapsed = Date.now() - joinedAt;

  if (elapsed < 5 * 60_000) return "just now";
  if (elapsed < DAY) return relativeTimeFormat.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 30 * DAY) return relativeTimeFormat.format(-Math.floor(elapsed / DAY), "day");
  return relativeTimeFormat.format(-Math.floor(elapsed / (30 * DAY)), "month");
}

const submitLabel = computed(() => (roomId.value ? "Join room" : "Create new room"));
const disabled = computed(() => !username.value);
</script>

<template>
  <main class="home-page">
    <section class="home-shell" aria-labelledby="home-title">
      <div class="hero-copy">
        <span class="privacy-badge">
          <i class="pi pi-sparkles" aria-hidden="true" />
          No sign-up. No tracking.
        </span>

        <div class="mobile-card-fan" aria-hidden="true">
          <span
            v-for="(value, index) in CARD_VALUES"
            :key="`${value}-mobile`"
            :class="`card card-${index}`"
          >
            {{ value }}
          </span>
        </div>

        <h1 id="home-title">
          Plan poker,<br />
          <span>without the</span> <span class="italic">fluff.</span>
        </h1>
        <p>Pick a name. Share a room ID. Vote on stories together. That's the whole product.</p>

        <div class="desktop-card-fan" aria-hidden="true">
          <span
            v-for="(value, index) in CARD_VALUES"
            :key="`${value}-desktop`"
            :class="`card card-${index}`"
          >
            {{ value }}
          </span>
        </div>
      </div>

      <form class="room-panel" @submit.prevent="join()">
        <div class="panel-heading">
          <p>Get started</p>
          <h2>Join or create a room</h2>
        </div>

        <div class="field-stack">
          <FloatLabel variant="on">
            <InputText
              id="username"
              v-model.trim="username"
              autocomplete="name"
              size="large"
              autofocus
            />
            <label for="username">Display name</label>
          </FloatLabel>

          <FloatLabel variant="on">
            <InputText id="roomId" v-model.trim="roomId" autocomplete="off" size="large" />
            <label for="roomId">Room ID</label>
          </FloatLabel>
        </div>

        <VButton
          type="submit"
          class="join-button"
          :label="submitLabel"
          icon="pi pi-chevron-right"
          icon-pos="right"
          :disabled="disabled"
        />

        <div v-if="recentRooms.length" class="recent-rooms" aria-labelledby="recent-rooms-title">
          <div class="recent-divider">
            <span>or pick up where you left off</span>
          </div>

          <h3 id="recent-rooms-title">Recent rooms</h3>
          <button
            v-for="recentRoom in recentRooms"
            :key="recentRoom.id"
            type="button"
            class="recent-room"
            :aria-label="`Rejoin room ${recentRoom.id.toUpperCase()} as ${recentRoom.username}`"
            :disabled="!username && !recentRoom.username"
            @click="useRecentRoom(recentRoom)"
          >
            <span class="room-mark">{{ recentRoom.id.slice(0, 2).toUpperCase() }}</span>
            <span class="room-meta">
              <strong>{{ recentRoom.id.toUpperCase() }}</strong>
              <small>
                as {{ recentRoom.username }}
                <span>{{ formatJoinedAt(recentRoom.joinedAt) }}</span>
              </small>
            </span>
            <span class="rejoin">
              <i class="pi pi-sign-in" aria-hidden="true" />
              rejoin
            </span>
          </button>

          <button type="button" class="clear-history" @click="clearRecentRooms()">
            Clear history
          </button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped lang="scss">
.home-page {
  min-height: calc(100vh - var(--nav-height) - var(--footer-height));
  padding: 0 clamp(1rem, 3vw, 3rem);
}

.home-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(24rem, 30rem);
  align-items: center;
  gap: clamp(3rem, 8vw, 8rem);
  max-width: 82rem;
  min-height: inherit;
  margin: 0 auto;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  p {
    max-width: 35rem;
    margin: 2rem 0 0;
    color: var(--p-text-muted-color);
    font-size: 1.25rem;
    line-height: 1.55;
  }

  h1 {
    margin: 0;
    max-width: 42rem;
    color: var(--p-text-color);
    font-size: clamp(4rem, 5vw, 5.5rem);
    line-height: 0.96;

    span {
      color: var(--p-primary-color);
    }

    .italic {
      color: var(--p-text-color);
      font-style: italic;
      font-weight: 700;
    }
  }
}

.privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 2rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: var(--p-primary-color);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* --- Card fan --- */

.desktop-card-fan,
.mobile-card-fan {
  align-self: center;
  position: relative;
  width: 20rem;
  height: 10rem;
  margin-top: 3.5rem;
}

.mobile-card-fan {
  display: none;
}

.card {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5.5rem;
  height: 7.8rem;
  border-radius: 0.85rem;
  color: color-mix(in srgb, var(--p-surface-950) 88%, transparent);
  font-size: 2.35rem;
  font-weight: 800;
  box-shadow: 0 1rem 2.5rem color-mix(in srgb, var(--p-surface-950) 20%, transparent);
  transform-origin: 50% 90%;
  left: var(--card-x);
  top: var(--card-y);
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &.card-0 {
    --card-x: 0;
    --card-y: 1.4rem;
    background: var(--p-red-400);
    --card-rotation: -14deg;
  }
  &.card-1 {
    --card-x: 3rem;
    --card-y: 0.9rem;
    background: var(--p-amber-400);
    --card-rotation: -7deg;
  }
  &.card-2 {
    --card-x: 6rem;
    --card-y: 0.7rem;
    background: var(--p-emerald-500);
    --card-rotation: 1deg;
  }
  &.card-3 {
    --card-x: 9rem;
    --card-y: 0.9rem;
    background: var(--p-violet-400);
    --card-rotation: 7deg;
  }
  &.card-4 {
    --card-x: 12rem;
    --card-y: 1.25rem;
    background: var(--p-red-400);
    --card-rotation: 14deg;
  }

  & {
    transform: translateY(0) rotate(var(--card-rotation));
  }

  &:hover {
    box-shadow: 0 1.35rem 2.75rem color-mix(in srgb, var(--p-surface-950) 28%, transparent);
    transform: translateY(-0.65rem) rotate(var(--card-rotation));
  }
}

/* --- Room panel --- */

.room-panel {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  padding: 2rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 1.25rem;
  background: var(--p-content-background);
  box-shadow: 0 1.5rem 4rem color-mix(in srgb, var(--p-surface-950) 18%, transparent);
}

.panel-heading {
  p {
    margin: 0 0 0.55rem;
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--p-text-color);
    font-size: 1.65rem;
    line-height: 1.15;
  }
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.join-button {
  width: 100%;
  min-height: 3.85rem;
  border: 0;
  border-radius: 0.8rem;
  background: linear-gradient(110deg, var(--p-primary-color), var(--p-green-400));
  color: var(--p-primary-contrast-color);
  font-weight: 800;
}

/* --- Recent rooms --- */

.recent-rooms {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;

  h3 {
    margin: 0.75rem 0 0.1rem;
    color: var(--p-text-muted-color);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
}

.recent-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--p-content-border-color);
  }
}

.recent-room {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.8rem;
  background: var(--p-content-background);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: var(--p-content-hover-background);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .room-mark {
    display: grid;
    place-items: center;
    width: 2.65rem;
    height: 2.65rem;
    border-radius: 0.55rem;
    background: var(--p-amber-400);
    color: var(--p-surface-950);
    font-weight: 800;
  }

  .room-meta {
    min-width: 0;

    strong {
      display: block;
      overflow: hidden;
      color: var(--p-text-color);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      display: block;
      color: var(--p-text-muted-color);
      line-height: 1.5;

      span {
        display: block;
      }
    }
  }

  .rejoin {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.55rem;
    border-radius: 0.35rem;
    background: var(--p-highlight-background);
    color: var(--p-text-muted-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
  }
}

.clear-history {
  align-self: center;
  margin-top: 0.9rem;
  border: 0;
  background: transparent;
  color: var(--p-text-muted-color);
  text-decoration: underline;
  cursor: pointer;
}

/* --- PrimeVue overrides --- */

:deep(.p-floatlabel) {
  width: 100%;
}

:deep(.p-inputtext) {
  width: 100%;
  min-height: 4.5rem;
  border-color: var(--p-form-field-border-color);
  border-radius: 0.8rem;
  background: var(--p-form-field-background);
  color: var(--p-form-field-color);
  font-weight: 700;
  box-shadow: none;

  &:enabled:focus {
    border-color: var(--p-primary-color);
    box-shadow: 0 0 0 1px var(--p-primary-color);
  }
}

:deep(.p-floatlabel label) {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* --- Mobile --- */

@media (max-width: 767px) {
  .home-page {
    padding: 1.5rem 1.25rem 2rem;
  }

  .home-shell {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 1.8rem;
  }

  .hero-copy {
    align-items: center;
    text-align: center;

    h1 {
      font-size: clamp(2.7rem, 12vw, 4rem);
    }

    p {
      margin-top: 1rem;
      font-size: 1rem;
    }
  }

  .privacy-badge {
    align-self: center;
    margin-bottom: 2rem;
  }

  .desktop-card-fan {
    display: none;
  }

  .mobile-card-fan {
    display: block;
    width: 15rem;
    height: 8.5rem;
    margin: 0 0 0.5rem;
  }

  .card {
    width: 4.4rem;
    height: 6.25rem;
    border-radius: 0.75rem;
    font-size: 1.85rem;

    &.card-0 {
      --card-x: 1rem;
    }
    &.card-1 {
      --card-x: 3.2rem;
    }
    &.card-2 {
      --card-x: 5.4rem;
    }
    &.card-3 {
      --card-x: 7.6rem;
    }
    &.card-4 {
      --card-x: 9.8rem;
    }
  }

  .room-panel {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .panel-heading,
  .recent-divider {
    display: none;
  }
}
</style>
