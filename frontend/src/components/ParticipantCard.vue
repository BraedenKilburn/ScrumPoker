<script setup lang="ts">
import { computed } from "vue";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";
import PointCard from "@/components/PointCard.vue";

const props = defineProps<{
  name: string;
  point?: string;
  isAdmin?: boolean;
  isCurrentUser?: boolean;
  revealed?: boolean;
  canManageAdmin?: boolean;
  canRemove?: boolean;
}>();

defineEmits<{
  transferAdmin: [];
  remove: [];
}>();

const initials = computed(() => getInitials(props.name));
const avatarBg = computed(() => paletteVar[getAvatarColor(props.name)]);
const hasVoted = computed(() => props.point != null);
const displayName = computed(() => (props.isCurrentUser ? "You" : props.name));
</script>

<template>
  <div class="participant-card surface-panel" :class="{ 'is-current': isCurrentUser }">
    <div class="avatar-wrap">
      <div class="avatar" :style="{ background: avatarBg }">
        <span>{{ initials }}</span>
      </div>
      <i v-if="isAdmin" class="pi pi-crown crown" aria-label="Room admin" />
      <button
        v-else-if="canManageAdmin"
        class="admin-action"
        type="button"
        :aria-label="`Make ${name} admin`"
        title="Make admin"
        @click="$emit('transferAdmin')"
      >
        <i class="pi pi-crown" aria-hidden="true" />
      </button>
    </div>

    <button
      v-if="canRemove"
      class="remove-action"
      type="button"
      :aria-label="`Remove ${name} from room`"
      title="Remove participant"
      @click="$emit('remove')"
    >
      <i class="pi pi-times" aria-hidden="true" />
    </button>

    <span class="name">{{ displayName }}</span>

    <div class="vote-slot">
      <Transition name="vote-fade" mode="out-in">
        <PointCard v-if="revealed && hasVoted" :key="`face-${point}`" :value="point" size="sm" />
        <PointCard v-else-if="hasVoted" key="back" face-down size="sm" />
        <span v-else key="thinking" class="thinking">thinking…</span>
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.participant-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.4rem;
  border-radius: 0.75rem;
  min-height: 7rem;
  transition: border-color 0.2s ease;

  &:hover .remove-action,
  &:focus-within .remove-action,
  &:hover .admin-action,
  &:focus-within .admin-action {
    opacity: 1;
  }

  @media (min-width: 480px) {
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    border-radius: 1rem;
    min-height: 9.5rem;
  }

  &.is-current {
    border-color: color-mix(in srgb, var(--p-primary-color) 60%, transparent);
  }

  .avatar-wrap {
    position: relative;
  }

  .avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
    font-weight: 800;
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    @media (min-width: 480px) {
      width: 3rem;
      height: 3rem;
      border-radius: 0.6rem;
      font-size: 0.95rem;
    }
  }

  .crown {
    position: absolute;
    top: -5px;
    right: -6px;
    color: var(--p-amber-400);
    font-size: 0.6rem;
    background: var(--p-content-background);
    border-radius: 999px;
    padding: 2px 3px;
    box-shadow: 0 0 0 1px var(--p-content-border-color);

    @media (min-width: 480px) {
      top: -6px;
      right: -8px;
      font-size: 0.75rem;
      padding: 3px 4px;
    }
  }

  .admin-action {
    position: absolute;
    top: -5px;
    right: -6px;
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
    opacity: 0;
    transition:
      opacity 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      transform 0.15s ease;

    .pi {
      font-size: 0.65rem;
    }

    &:hover,
    &:focus-visible {
      color: var(--p-amber-400);
      border-color: color-mix(in srgb, var(--p-amber-400) 60%, transparent);
      transform: translateY(-1px);
      opacity: 1;
    }

    &:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 2px;
    }

    @media (hover: none) {
      opacity: 1;
    }

    @media (min-width: 480px) {
      top: -6px;
      right: -8px;
      width: 1.6rem;
      height: 1.6rem;

      .pi {
        font-size: 0.75rem;
      }
    }
  }

  .name {
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--p-text-color);
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (min-width: 480px) {
      font-size: 0.9rem;
    }
  }

  .remove-action {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 1.4rem;
    height: 1.4rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 999px;
    background: color-mix(in srgb, var(--p-content-background) 85%, black);
    color: var(--p-text-muted-color);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;

    .pi {
      font-size: 0.65rem;
    }

    &:hover,
    &:focus-visible {
      color: var(--p-red-400);
      border-color: var(--p-red-400);
      opacity: 1;
    }

    &:focus-visible {
      outline: 2px solid var(--p-red-400);
      outline-offset: 2px;
    }

    @media (hover: none) {
      opacity: 1;
    }
  }

  .vote-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;

    @media (min-width: 480px) {
      min-height: 3.75rem;
    }

    .thinking {
      font-style: italic;
      color: var(--p-text-muted-color);
      font-size: 0.7rem;

      @media (min-width: 480px) {
        font-size: 0.8rem;
      }
    }
  }
}

.vote-fade-enter-active,
.vote-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.vote-fade-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

.vote-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}
</style>
