<script setup lang="ts">
import { computed } from "vue";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";
import type { RoomMember } from "@/modules/roomMembers";

const props = defineProps<{ members: RoomMember[] }>();

const sortedMembers = computed(() =>
  [...props.members].sort((a, b) => {
    if (a.point != null && b.point == null) return -1;
    if (a.point == null && b.point != null) return 1;
    return a.name.localeCompare(b.name);
  }),
);
</script>

<template>
  <aside class="voting-progress surface-panel">
    <h3 class="title">Voting in progress</h3>
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
  </aside>
</template>

<style scoped lang="scss">
.voting-progress {
  padding: 1.25rem;

  .title {
    margin: 0 0 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--p-text-muted-color);
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
