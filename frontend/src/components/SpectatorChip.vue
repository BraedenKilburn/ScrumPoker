<script setup lang="ts">
import { computed } from "vue";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";
import CrownIcon from "@primeicons/vue/crown";
import EyeIcon from "@primeicons/vue/eye";
import TimesIcon from "@primeicons/vue/times";

const props = defineProps<{
  name: string;
  isAdmin?: boolean;
  isCurrentUser?: boolean;
  canManageAdmin?: boolean;
  canRemove?: boolean;
}>();

defineEmits<{
  transferAdmin: [];
  remove: [];
}>();

const initials = computed(() => getInitials(props.name));
const avatarBg = computed(() => paletteVar[getAvatarColor(props.name)]);
const displayName = computed(() => (props.isCurrentUser ? "You" : props.name));
</script>

<template>
  <div class="spectator-chip" :class="{ 'is-current': isCurrentUser }">
    <span class="avatar" :style="{ background: avatarBg }">{{ initials }}</span>
    <span class="name">{{ displayName }}</span>
    <!-- The crown outranks the eye: the spectator row already says
         "watching", so only the admin fact earns the icon slot. -->
    <CrownIcon
      v-if="isAdmin"
      class="pi crown"
      role="img"
      aria-label="Room admin"
      :aria-hidden="false"
    />
    <EyeIcon v-else class="pi" aria-hidden="true" />
    <span class="visually-hidden">spectating</span>

    <!-- Collapsed to zero width until hover/focus, then the chip grows at
         its trailing end so the pointer stays on it. -->
    <div v-if="canManageAdmin || canRemove" class="actions">
      <div class="actions-inner">
        <button
          v-if="canManageAdmin"
          class="admin-action"
          type="button"
          :aria-label="`Make ${name} admin`"
          title="Make admin"
          @click="$emit('transferAdmin')"
        >
          <CrownIcon class="pi" aria-hidden="true" />
        </button>
        <button
          v-if="canRemove"
          class="remove-action"
          type="button"
          :aria-label="`Remove ${name} from room`"
          title="Remove participant"
          @click="$emit('remove')"
        >
          <TimesIcon class="pi" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Deliberately smaller than ParticipantCard so the board reads "voters
   here, observers over there" at a glance. */
.spectator-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.65rem 0.3rem 0.3rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 999px;
  background: var(--surface-panel);

  &.is-current {
    border-color: color-mix(in srgb, var(--p-primary-color) 60%, transparent);
  }

  &:hover .actions,
  &:focus-within .actions {
    grid-template-columns: 1fr;
    margin-left: 0;
    opacity: 1;
  }

  .avatar {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
    font-weight: 800;
    font-size: 0.6rem;
    font-family: ui-monospace, monospace;
  }

  .name {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .p-icon-eye {
    font-size: 0.7rem;
    color: var(--p-text-muted-color);
    opacity: 0.7;
  }

  .crown {
    font-size: 0.7rem;
    color: var(--ink-amber);
  }

  /* Animating the track from 0fr to 1fr gives a smooth width reveal
     without hard-coding the buttons' width. The negative margin swallows
     the chip's gap while collapsed so the resting chip is unchanged. */
  .actions {
    display: grid;
    grid-template-columns: 0fr;
    margin-left: -0.5rem;
    opacity: 0;
    transition:
      grid-template-columns 0.2s ease,
      margin-left 0.2s ease,
      opacity 0.2s ease;

    @media (hover: none) {
      grid-template-columns: 1fr;
      margin-left: 0;
      opacity: 1;
    }
  }

  /* Padding keeps the focus rings inside the clipped track: it must cover
     the buttons' outline width + offset (2px + 1px below). */
  .actions-inner {
    display: flex;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
    padding: 3px;
    margin: -3px;
  }

  .admin-action,
  .remove-action {
    flex: none;
    width: 1.35rem;
    height: 1.35rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 999px;
    background: var(--p-content-background);
    color: var(--p-text-muted-color);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;

    .pi {
      font-size: 0.6rem;
    }

    &:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 1px;
    }
  }

  .admin-action:hover,
  .admin-action:focus-visible {
    color: var(--ink-amber);
    border-color: color-mix(in srgb, var(--p-amber-400) 60%, transparent);
  }

  .remove-action {
    &:hover,
    &:focus-visible {
      color: var(--ink-red);
      border-color: var(--ink-red);
    }

    &:focus-visible {
      outline-color: var(--p-red-400);
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
</style>
