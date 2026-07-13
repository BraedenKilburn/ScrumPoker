<script setup lang="ts">
import { computed } from "vue";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";

const props = defineProps<{
  name: string;
  isCurrentUser?: boolean;
}>();

const initials = computed(() => getInitials(props.name));
const avatarBg = computed(() => paletteVar[getAvatarColor(props.name)]);
const displayName = computed(() => (props.isCurrentUser ? "You" : props.name));
</script>

<template>
  <div class="spectator-chip" :class="{ 'is-current': isCurrentUser }">
    <span class="avatar" :style="{ background: avatarBg }">{{ initials }}</span>
    <span class="name">{{ displayName }}</span>
    <i class="pi pi-eye" aria-hidden="true" />
    <span class="visually-hidden">spectating</span>
  </div>
</template>

<style scoped lang="scss">
// Deliberately smaller than ParticipantCard so the board reads "voters
// here, observers over there" at a glance.
.spectator-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.65rem 0.3rem 0.3rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 999px;
  background: color-mix(in srgb, var(--p-content-background) 88%, black);

  &.is-current {
    border-color: color-mix(in srgb, var(--p-primary-color) 60%, transparent);
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

  .pi-eye {
    font-size: 0.7rem;
    color: var(--p-text-muted-color);
    opacity: 0.7;
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
