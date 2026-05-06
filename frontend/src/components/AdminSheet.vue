<script setup lang="ts">
import { computed } from "vue";
import Drawer from "primevue/drawer";
import type { RoomMember } from "@/modules/roomMembers";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";

const props = defineProps<{
  visible: boolean;
  members: RoomMember[];
  votesVisible: boolean;
  votesLocked: boolean;
  hasVotes: boolean;
  votedCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
  reveal: [];
  newRound: [];
  toggleLock: [];
  clearAll: [];
  transferAdmin: [name: string];
  removeParticipant: [name: string];
}>();

function close() {
  emit("update:visible", false);
}

const manageableMembers = computed(() => props.members.filter((member) => !member.isCurrentUser));
</script>

<template>
  <Drawer
    :visible="visible"
    position="bottom"
    :pt="{ root: { class: 'admin-drawer' } }"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <template #header>
      <div class="sheet-header">
        <span class="label"><i class="pi pi-crown" /> ADMIN CONTROLS</span>
      </div>
    </template>

    <div class="sheet-body">
      <button
        v-if="!votesVisible"
        class="primary-action reveal"
        :disabled="!hasVotes"
        @click="
          emit('reveal');
          close();
        "
      >
        <i class="pi pi-eye" />
        <span>Reveal Votes</span>
        <span class="count">{{ votedCount }}/{{ totalCount }}</span>
      </button>
      <button
        v-else
        class="primary-action new-round"
        @click="
          emit('newRound');
          close();
        "
      >
        <i class="pi pi-refresh" />
        <span>New Round</span>
      </button>

      <div class="action-row">
        <button
          class="tile"
          :class="{ on: votesLocked }"
          :disabled="!hasVotes"
          @click="emit('toggleLock')"
        >
          <i :class="votesLocked ? 'pi pi-lock' : 'pi pi-unlock'" />
          <strong>{{ votesLocked ? "Locked" : "Lock votes" }}</strong>
          <span>{{ votesLocked ? "No more changes" : "Prevent edits" }}</span>
        </button>

        <button class="destructive" :disabled="!hasVotes" @click="emit('clearAll')">
          <i class="pi pi-trash" />
          <strong>Clear all votes</strong>
          <span>Reset round</span>
        </button>
      </div>

      <div v-if="manageableMembers.length" class="manage">
        <h4>Manage team</h4>
        <ul>
          <li v-for="m in manageableMembers" :key="m.name">
            <span class="avatar" :style="{ background: paletteVar[getAvatarColor(m.name)] }">
              {{ getInitials(m.name) }}
            </span>
            <span class="name">{{ m.name }}</span>
            <button
              class="icon-btn"
              :disabled="m.isAdmin"
              :title="m.isAdmin ? 'Already admin' : 'Make admin'"
              @click="emit('transferAdmin', m.name)"
            >
              <i class="pi pi-crown" />
            </button>
            <button
              class="icon-btn danger"
              title="Remove participant"
              @click="emit('removeParticipant', m.name)"
            >
              <i class="pi pi-trash" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </Drawer>
</template>

<style lang="scss">
.p-component.p-drawer.admin-drawer {
  border: none;
  border-top-left-radius: 1.25rem;
  border-top-right-radius: 1.25rem;
  height: auto;
  max-height: 90vh;
}
</style>

<style scoped lang="scss">
.sheet-header .label {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--p-amber-400);
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.primary-action {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  border-radius: 0.85rem;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  color: #052e1a;
  background: linear-gradient(135deg, var(--p-emerald-400), var(--p-green-400));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--p-emerald-400) 35%, transparent);

  &.new-round {
    background: linear-gradient(135deg, var(--p-amber-400), var(--p-amber-500));
    color: #2b1a04;
  }

  .count {
    margin-left: auto;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;
}

.tile {
  background: color-mix(in srgb, var(--p-content-background) 80%, black);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;
  padding: 0.85rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--p-text-color);
  cursor: pointer;
  font: inherit;

  .pi {
    color: var(--p-text-muted-color);
  }

  strong {
    font-size: 0.9rem;
  }

  span {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
  }

  &.on {
    border-color: color-mix(in srgb, var(--p-amber-400) 60%, transparent);
    .pi,
    strong {
      color: var(--p-amber-400);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.destructive {
  background: color-mix(in srgb, var(--p-red-400) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-red-400) 35%, transparent);
  border-radius: 0.75rem;
  padding: 0.85rem;
  text-align: left;
  color: var(--p-red-400);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
  font: inherit;

  strong {
    font-size: 0.9rem;
  }
  span {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .pi {
    align-self: flex-start;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.manage {
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 0.75rem;

  h4 {
    margin: 0 0 0.5rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--p-text-muted-color);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  li {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 0.6rem;
  }

  .avatar {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
    font-weight: 800;
    font-size: 0.7rem;
    font-family: ui-monospace, monospace;
  }

  .name {
    font-size: 0.9rem;
  }

  .icon-btn {
    background: transparent;
    border: 1px solid var(--p-content-border-color);
    color: var(--p-text-muted-color);
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--p-text-color);
      border-color: var(--p-text-color);
    }

    &.danger:hover:not(:disabled) {
      color: var(--p-red-400);
      border-color: var(--p-red-400);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
