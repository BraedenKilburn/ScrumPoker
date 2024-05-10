<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { Socket } from 'socket.io-client';
import { useRouter } from 'vue-router';
import { useRootStore } from '@/stores/root';

const socket = inject<Socket>('socket')

const rId = ref('');
const username = ref('');

const roomId = computed(() => rId.value.trim().toLowerCase());

const store = useRootStore();
const router = useRouter();
function createRoom() {
  socket?.emit('createRoom', { roomId: roomId.value, username: username.value});
  socket?.on('roomCreated', (data) => {
    const { roomId: id, socketId } = data;
    store.socketId = socketId;
    store.username = username.value;

    router.push({ name: 'Room', params: { id } });
  });
}

function joinRoom() {
  store.username = username.value;
  socket?.emit('joinRoom', { roomId: roomId.value, username: username.value });
  socket?.on('roomJoined', (id) => {
    router.push({ name: 'Room', params: { id } });
  });
}

const disabled = computed(() => !roomId.value || !username.value);
</script>

<template>
  <main>
    <div class="intro">
      <h1>Welcome to Scrum Poker</h1>
      <p>
        Enter a username and a room ID to join an existing room or create a new
        room.
      </p>
    </div>
    <div class="card">
      <FloatLabel>
        <InputText id="username" v-model="username" autocomplete="off" />
        <label for="username">Username</label>
      </FloatLabel>
      <FloatLabel>
        <InputText id="roomId" v-model="rId" autocomplete="off" />
        <label for="roomId">Room ID</label>
      </FloatLabel>

      <VButton
        class="join-button"
        label="Join Room"
        :disabled
        @click="joinRoom"
      />

      <VButton
        label="Create New Room"
        severity="secondary"
        class="create-button"
        :disabled
        @click="createRoom"
      />
    </div>
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  text-align: center;

  .card {
    width: 90vw;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: var(--surface-card);

    input {
      width: 100%;
    }

    .p-float-label {
      margin-top: 1rem;
    }
  }
}

@media (min-width: 768px) {
  main {
    .card {
      width: 50vw;
    }
  }
}
</style>