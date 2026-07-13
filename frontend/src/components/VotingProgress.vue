<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useScrollFades } from "@/composables/useScrollFades";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";
import type { RoomMember, SpectatorMember } from "@/modules/roomMembers";

const props = defineProps<{ members: RoomMember[]; spectators?: SpectatorMember[] }>();

const sortedMembers = computed(() =>
  [...props.members].sort((a, b) => {
    if (a.point != null && b.point == null) return -1;
    if (a.point == null && b.point != null) return 1;
    return a.name.localeCompare(b.name);
  }),
);

const readyCount = computed(() => props.members.filter((m) => m.point != null).length);

// Edge fades hint at rows hidden above/below the fold of each scroll region.
const voterScrollEl = useTemplateRef("voterScrollEl");
const spectatorListEl = useTemplateRef("spectatorListEl");
const {
  moreAbove: votersAbove,
  moreBelow: votersBelow,
  update: updateVoterFades,
} = useScrollFades(voterScrollEl);
const {
  moreAbove: watchersAbove,
  moreBelow: watchersBelow,
  update: updateWatcherFades,
} = useScrollFades(spectatorListEl);
watch(
  () => props.members.length,
  () => nextTick(updateVoterFades),
);
watch(
  () => props.spectators?.length,
  () => nextTick(updateWatcherFades),
);

// Past this many, spectators collapse to an avatar stack so they never push
// the voter list out of the rail.
const SPECTATOR_PREVIEW = 3;
const spectatorsExpanded = ref(false);
const spectatorOverflow = computed(() =>
  Math.max(0, (props.spectators?.length ?? 0) - SPECTATOR_PREVIEW),
);
const previewSpectators = computed(() => (props.spectators ?? []).slice(0, SPECTATOR_PREVIEW));
// The list stays open with no toggle at all when it's short enough.
const spectatorsOpen = computed(() => spectatorsExpanded.value || !spectatorOverflow.value);
</script>

<template>
  <aside class="voting-progress surface-panel">
    <div class="progress-head">
      <h3 class="title panel-title">Voting in progress</h3>
      <span class="count">{{ readyCount }}/{{ members.length }} voted</span>
    </div>
    <div
      class="voter-viewport scroll-fade"
      :class="{ 'fade-top': votersAbove, 'fade-bottom': votersBelow }"
    >
      <div ref="voterScrollEl" class="voter-scroll" @scroll.passive="updateVoterFades">
        <TransitionGroup tag="ul" name="vp-list">
          <li v-for="m in sortedMembers" :key="m.name" :class="{ ready: m.point != null }">
            <span class="dot" :class="{ ready: m.point != null }" />
            <span class="avatar" :style="{ background: paletteVar[getAvatarColor(m.name)] }">
              {{ getInitials(m.name) }}
            </span>
            <span class="name">{{ m.isCurrentUser ? "You" : m.name }}</span>
            <span class="status-slot">
              <Transition name="vp-status" mode="out-in">
                <span
                  :key="`${m.name}-${m.point != null ? 'ready' : 'pending'}`"
                  class="status"
                  :class="{ ready: m.point != null }"
                >
                  {{ m.point != null ? "ready" : "…" }}
                </span>
              </Transition>
            </span>
          </li>
        </TransitionGroup>
      </div>
    </div>

    <template v-if="spectators?.length">
      <div class="spectator-divider" role="presentation">
        <span class="line" />
        <span class="label"><i class="pi pi-eye" /> Spectating · {{ spectators.length }}</span>
        <span class="line" />
      </div>

      <div class="spectator-reveal" :class="{ open: spectatorsOpen }">
        <div class="inner">
          <div
            class="scroll-fade"
            :class="{ 'fade-top': watchersAbove, 'fade-bottom': watchersBelow }"
          >
            <ul ref="spectatorListEl" class="spectator-list" @scroll.passive="updateWatcherFades">
              <li v-for="s in spectators" :key="s.name">
                <span class="avatar" :style="{ background: paletteVar[getAvatarColor(s.name)] }">
                  {{ getInitials(s.name) }}
                </span>
                <span class="spectator-name">{{ s.isCurrentUser ? "You" : s.name }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <button
        v-if="spectatorOverflow"
        class="spectator-toggle"
        :aria-expanded="spectatorsExpanded"
        @click="spectatorsExpanded = !spectatorsExpanded"
      >
        <Transition name="toggle-face" mode="out-in">
          <span v-if="!spectatorsExpanded" key="peek" class="face peek">
            <span class="stack" aria-hidden="true">
              <span
                v-for="s in previewSpectators"
                :key="s.name"
                class="avatar"
                :style="{ background: paletteVar[getAvatarColor(s.name)] }"
              >
                {{ getInitials(s.name) }}
              </span>
            </span>
            <span class="more">+{{ spectatorOverflow }} more</span>
          </span>
          <span v-else key="less" class="face less">Show less</span>
        </Transition>
        <i class="pi pi-chevron-down" :class="{ flipped: spectatorsExpanded }" aria-hidden="true" />
      </button>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.voting-progress {
  padding: 1.25rem;

  .progress-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;

    .count {
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
      white-space: nowrap;
    }
  }

  // Edge scrims over a scroll region: rows dissolve into the panel background
  // toward whichever edge still has content beyond it. A solid band at the
  // very edge keeps the cue readable against the already-dark panel.
  .scroll-fade {
    --fade-size: 3.25rem;
    position: relative;

    &::before,
    &::after {
      content: "";
      position: absolute;
      // Above the positioned scroll region, which otherwise paints over the
      // ::before (earlier in DOM order).
      z-index: 1;
      left: 0;
      right: 0;
      height: var(--fade-size);
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
    }

    &::before {
      top: 0;
      background: linear-gradient(
        to bottom,
        color-mix(in srgb, var(--p-content-background) 88%, black) 18%,
        transparent
      );
    }

    &::after {
      bottom: 0;
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--p-content-background) 88%, black) 18%,
        transparent
      );
    }

    &.fade-top::before {
      opacity: 1;
    }

    &.fade-bottom::after {
      opacity: 1;
    }
  }

  // The head stays outside this region, so the X/Y count is always visible
  // however far the list scrolls.
  .voter-scroll {
    position: relative;
    max-height: clamp(10rem, calc(100vh - 30rem), 24rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  li {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--p-text-muted-color);
    opacity: 0.5;
    box-shadow: 0 0 0 transparent;
    transition:
      background-color 0.3s ease,
      opacity 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.3s ease;

    &.ready {
      background: var(--p-emerald-400);
      opacity: 1;
      box-shadow: 0 0 8px var(--p-emerald-400);
      animation: dot-pop 0.4s ease;
    }
  }

  @keyframes dot-pop {
    0% {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.4);
    }
    100% {
      transform: scale(1);
    }
  }

  .name {
    transition: color 0.3s ease;
  }

  li.ready .name {
    color: var(--p-text-color);
  }

  .status-slot {
    min-width: 2.5rem;
    text-align: right;
  }

  .status {
    color: var(--p-text-muted-color);
    display: inline-block;
    font-size: 0.8rem;
    line-height: 1;

    &.ready {
      color: var(--p-emerald-400);
    }
  }

  .avatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 800;
    color: #0a0a0a;
    font-family: ui-monospace, monospace;
  }

  .name {
    color: var(--p-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // Spectators sit below a divider with no status dot or ready state —
  // they're present, not pending.
  .spectator-divider {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0 0.65rem;

    .line {
      flex: 1;
      height: 1px;
      background: var(--p-content-border-color);
    }

    .label {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.65rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);

      .pi {
        font-size: 0.7rem;
      }
    }
  }

  // Animates between collapsed (0fr) and the list's natural height (1fr).
  .spectator-reveal {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease;

    &.open {
      grid-template-rows: 1fr;
    }

    .inner {
      overflow: hidden;
      min-height: 0;
    }

    // The spectator cap is only 9rem, so its fades stay proportionate.
    .scroll-fade {
      --fade-size: 2rem;
    }
  }

  .spectator-list {
    max-height: 9rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .spectator-list li {
    grid-template-columns: auto 1fr;
  }

  .spectator-name {
    color: var(--p-text-muted-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spectator-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.3rem 0.4rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    color: var(--p-text-muted-color);
    font: inherit;
    font-size: 0.8rem;
    transition: background-color 0.2s ease;

    &:hover {
      background: var(--p-content-hover-background);
    }

    .face {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      &.less {
        justify-content: center;
      }
    }

    .stack {
      display: flex;

      .avatar {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-content-background) 88%, black);

        &:not(:first-child) {
          margin-left: -0.4rem;
        }
      }
    }

    .pi {
      font-size: 0.65rem;
      transition: transform 0.3s ease;

      &.flipped {
        transform: rotate(180deg);
      }
    }
  }
}

.toggle-face-enter-active,
.toggle-face-leave-active {
  transition: opacity 0.15s ease;
}
.toggle-face-enter-from,
.toggle-face-leave-to {
  opacity: 0;
}

.vp-list-enter-active,
.vp-list-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.vp-list-enter-from,
.vp-list-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
.vp-list-leave-active {
  position: absolute;
}

.vp-status-enter-active,
.vp-status-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.vp-status-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.vp-status-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
