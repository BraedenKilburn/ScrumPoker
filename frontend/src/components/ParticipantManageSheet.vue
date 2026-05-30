<script setup lang="ts">
import { computed } from "vue";
import Drawer from "primevue/drawer";
import type { RoomMember } from "@/modules/roomMembers";
import { getAvatarColor, getInitials, paletteVar } from "@/modules/avatarColor";

const props = defineProps<{
  visible: boolean;
  members: RoomMember[];
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
  transferAdmin: [name: string];
  removeParticipant: [name: string];
}>();

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
        <span class="label"><i class="pi pi-users" /> MANAGE PARTICIPANTS</span>
      </div>
    </template>

    <div class="sheet-body">
      <div v-if="manageableMembers.length" class="manage">
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
      <p v-else class="empty">No other participants yet.</p>
    </div>
  </Drawer>
</template>

<style lang="scss">
.p-component.p-drawer.admin-drawer {
  border: none;
  border-top-left-radius: 1.25rem;
  border-top-right-radius: 1.25rem;
  height: auto;
  max-height: 70vh;
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

.manage {
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
    min-height: 2.75rem;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

.empty {
  margin: 0;
  padding: 1rem 0;
  color: var(--p-text-muted-color);
  text-align: center;
}
</style>
