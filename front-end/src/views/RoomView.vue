<script setup lang="ts">
import { computed, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usernameKey } from '@/modules/constants';
import {
  clearVotes,
  hideVotes,
  joinRoom,
  leaveRoom,
  revealVotes,
  submitVote,
} from '@/modules/socket';
import { useRootStore } from '@/stores/root';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import type InputText from 'primevue/inputtext';

// Room ID
const props = defineProps({ id: String });
const roomId = computed(() => props.id?.toLowerCase());

const store = useRootStore();
const { user, username, votesVisible } = storeToRefs(store);

// If entered room without a username (e.g., from a link),
// prompt the user to enter a username and join the room.
const isMissingUsername = computed(() => !username.value);
const usernameModel = ref(localStorage.getItem(usernameKey) ?? '');
function join() {
  if (!roomId.value || !usernameModel.value) return;
  store.setUsername(usernameModel.value);
  joinRoom({ roomId: roomId.value, username: usernameModel.value });
}

/**
 * All members in the room with their point estimates.
 * Used to display the table of members and their votes.
 */
const members = computed(() => {
  return store.participants.map(({ username, point_estimate }) => {
    const isSelf = username === user.value?.username;
    const point = isSelf ? point_estimate : '?';
    return {
      name: username,
      point: point_estimate ? (votesVisible.value ? point_estimate : point) : null
    }
  });
});

/**
 * Check if at least one member has voted.
 */
const hasVotes = computed(
  () => members.value
    .some(({ point }) => point != null)
);

/**
 * Toggle the visibility of all votes.
 */
function toggleVoteVisibility() {
  if (!roomId.value) return;
  if (votesVisible.value) hideVotes(roomId.value);
  else revealVotes(roomId.value);
  votesVisible.value = !votesVisible.value;
}

// Available points for voting
const points = ref(['21', '13', '8', '5', '3'])

/**
 * Submit a vote for the user.
 * @param point The point estimate to vote for.
 */
function vote(point: string | null) {
  if (!roomId.value) return;
  store.setUserPointEstimate(point);
  submitVote({
    roomId: roomId.value,
    pointEstimate: point ? point.toString() : null
  });
}

/**
 * Clear all votes in the room.
 */
function clearAllVotes() {
  if (!roomId.value) return;
  clearVotes(roomId.value);
}

const copiedRoomLink = ref(false);
/**
 * Copy the room link to the clipboard.
 */
function copyRoomLink() {
  navigator.clipboard.writeText(window.location.href);
  copiedRoomLink.value = true;
}

// reset store and leave room when navigating away
onBeforeRouteLeave(() => {
  store.$reset();
  if (!roomId.value) return;
  leaveRoom(roomId.value);
});

const usernameInput = ref<InstanceType<typeof InputText> | null>(null);
/**
 * Focus on the input field when the dialog is shown.
 */
function focusOnDialogInput() {
  if (!usernameInput.value) return;
  usernameInput.value.$el.focus();
}
</script>

<template>
  <main>
    <div class="actions">
      <RouterLink :to="{ name: 'Home' }">
        <VButton severity="danger" label="Leave Room" />
      </RouterLink>
      <VButton
        :label="votesVisible ? 'Hide Votes' : 'Reveal Votes'"
        severity="success"
        :disabled="!hasVotes"
        @click="toggleVoteVisibility()"
      />
      <VButton
        severity="secondary"
        label="Copy Room Link"
        :icon="copiedRoomLink ? 'pi pi-check' : 'pi pi-clipboard'"
        @click="copyRoomLink"
      />
    </div>

    <div class="container">
      <DataTable :value="members">
        <Column field="name" header="Name" />
        <Column field="point" header="Point" />
      </DataTable>

      <div class="options">
        <VButton
          v-for="point in points"
          :key="point"
          :label="point.toString()"
          @click="vote(point)"
        />
        <VButton
          label="Clear My Vote"
          severity="secondary"
          :disabled="!user || user.point_estimate == null"
          @click="vote(null)"
        />
        <VButton
          label="Clear All Votes"
          severity="danger"
          :disabled="!hasVotes"
          @click="clearAllVotes"
        />
      </div>
    </div>

    <VDialog
      :closable="false"
      :visible="isMissingUsername"
      modal
      header="Welcome"
      @show="focusOnDialogInput"
    >
      <p>Please enter a username to join the room.</p>
      <InputText ref="usernameInput" id="username" v-model="usernameModel" autocomplete="off" />
      <template #footer>
        <VButton
          label="Submit"
          :disabled="!usernameModel"
          @click="join"
        />
      </template>
    </VDialog>
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  h1 {
    margin: 0;
  }

  .actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0 1rem;
  }

  .container {
    width: 100%;
    display: flex;
    justify-content: space-around;
    gap: 1rem;
    padding: 0 1rem;

    .p-datatable {
      width: 80%;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  }
}

.p-dialog-content,
.p-dialog-footer {
  p {
    margin-top: 0;
  }

  input,
  button {
    width: 100%;
  }
}
</style>
