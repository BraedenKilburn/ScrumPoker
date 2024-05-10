<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { Socket } from 'socket.io-client';
import { isHost, username } from '@/modules/user'
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

const props = defineProps({
  id: String,
});
const roomId = computed(() => props.id?.toLowerCase());

const socket = inject<Socket>('socket')
socket?.emit('getMembers', roomId.value)

const usernameModel = ref('');
watch(username, () => {
  socket?.emit('joinRoom', {
    roomId: roomId.value,
    username: username.value
  });

  isHost.value = false;
});

// Display error message when username is taken
const userNameMessage = ref('')
socket?.on('bad-username', (message: string) => {
  username.value = '';
  usernameModel.value = '';
  userNameMessage.value = message
});

const router = useRouter();
socket?.on('bad-room', () => {
  router.push({ name: 'Home' });
});

socket?.on('roomDestroyed', () => {
  router.push({ name: 'Home' });
});

type UserPointMap = Record<string, { point?: number, visible: boolean }>;
const users = ref<UserPointMap>({});

// Get members with their points (used for the DataTable)
const members = computed(() => {
  return Object.entries(users.value)
    .map(([name, { point, visible }]) => ({
      name,
      point: point ? (visible ? point : '?') : undefined
    }));
});

// Update users when a new member joins
type Member = { username: string, point?: number };
socket?.on('update-members', (members: Member[]) => {
  users.value = members.reduce<UserPointMap>((acc, { username: name, point }) => {
    const visible = username.value === name;
    acc[name] = {
      point: users.value[name]?.point ?? point,
      visible
    };
    return acc;
  }, {});
});

// Check if at least one user has voted
const hasVotes = computed(
  () => Object.values(users.value)
    .some(({ point }) => point != null)
);

// Reveal votes
const votesVisible = ref(false);
function toggleVoteVisibility() {
  socket?.emit('toggleVoteVisibility', {
    roomId: roomId.value,
    visible: !votesVisible.value
  });
}

// Hide all votes
socket?.on('hideAllVotes', () => {
  votesVisible.value = false;
  Object.entries(users.value).forEach(([name, user]) => {
    if (username.value !== name) user.visible = false;
  });
});

// Reveal all votes
socket?.on('revealAllVotes', () => {
  votesVisible.value = true;
  Object.values(users.value).forEach(user => {
    user.visible = true;
  });
});

// Update user points when a vote is received
socket?.on('voteReceived', ({ username: name, point }) => {
  if (users.value[name]) {
    users.value[name].point = point;
    if (votesVisible.value) {
      users.value[name].visible = true;
    }
  }
});

// Available points for voting
const points = ref([21, 13, 8, 5, 3])
function vote(point?: number) {
  socket?.emit('vote', { roomId: roomId.value, point });
}

// Clear all votes
function clearAllVotes() {
  socket?.emit('clearAllVotes', roomId.value);
}
socket?.on('allVotesCleared', () => {
  Object.values(users.value).forEach(user => {
    user.point = undefined;
  });
});

// Copy room ID
const copiedRoomLink = ref(false);
function copyRoomLink() {
  navigator.clipboard.writeText(window.location.href);
  copiedRoomLink.value = true;
}

// Leave room when navigating away
onBeforeRouteLeave(() => {
  socket?.emit('leaveRoom', roomId.value);
});
</script>

<template>
  <main>
    <h1>Room: {{ id }}</h1>
    <div class="actions">
      <RouterLink :to="{ name: 'Home' }">
        <VButton severity="danger" label="Leave Room" />
      </RouterLink>
      <VButton
        v-if="isHost"
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
          :disabled="!users[username]"
          @click="vote()"
        />
        <VButton
          v-if="isHost"
          label="Clear All Votes"
          severity="danger"
          :disabled="!hasVotes"
          @click="clearAllVotes"
        />
      </div>
    </div>

    <VDialog
      :closable="false"
      :visible="!username"
      modal
      header="Welcome"
    >
      <p>Please enter a username to join the room.</p>
      <FloatLabel>
        <InputText id="username" v-model="usernameModel" autocomplete="off" />
        <label for="username">Username</label>
      </FloatLabel>
      <p v-if="userNameMessage" class="p-error">{{ userNameMessage }}</p>
      <template #footer>
        <VButton
          label="Submit"
          :disabled="!usernameModel"
          @click="username = usernameModel"
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

.p-dialog-content {
  p {
    margin-bottom: 2rem;
  }
  
  input {
    width: 100%;
  }
}
</style>