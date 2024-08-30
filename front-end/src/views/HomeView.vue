<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usernameKey } from '@/modules/constants';
import { joinRoom } from "@/modules/socket";
import { useRootStore } from '@/stores/root';
import type InputText from 'primevue/inputtext';

// Username
const username = ref(localStorage.getItem(usernameKey) ?? '');

// Room ID
const rId = ref('');
const roomId = computed(() => rId.value.toLowerCase());

const store = useRootStore();
const router = useRouter();

/**
 * If the username and room ID are not empty, join the room.
 */
function join() {
  if (!roomId.value || !username.value) return;
  store.setUsername(username.value);
  joinRoom({ roomId: roomId.value, username: username.value });
  router.push({ name: 'Room', params: { id: roomId.value } });
}

// Disable the join button if the room ID or username is empty.
const disabled = computed(() => !roomId.value || !username.value);

// Focus the username input
const usernameInput = ref<InstanceType<typeof InputText> | null>(null);
onMounted(() => {
  usernameInput.value?.$el.focus();
});
</script>

<template>
  <main>
    <div class="intro">
      <h1>Welcome to Scrum&nbsp;Poker</h1>
      <p>
        Enter a username and a room ID to join an existing room or create a new
        room.
      </p>
    </div>
    <VCard class="home-card">
      <template #content>
        <FloatLabel>
          <InputText ref="usernameInput" id="username" v-model.trim="username" autocomplete="off" size="large" />
          <label for="username">Username</label>
        </FloatLabel>
        <FloatLabel>
          <InputText id="roomId" v-model.trim="rId" autocomplete="off" size="large" />
          <label for="roomId">Room ID</label>
        </FloatLabel>
      </template>

      <template #footer>
        <VButton
          class="join-button"
          label="Join Room"
          :disabled
          @click="join"
        />
      </template>
    </VCard>
  </main>
</template>

<style lang="scss">
.home-card {
  --p-card-body-gap: 1.5rem;

  width: 90vw;

  .p-card-content {
    display: flex;
    flex-direction: column;
    gap: var(--p-card-body-gap);
    padding-top: var(--p-card-body-padding);

    input {
      width: 100%;
    }
  }

  @media (min-width: 768px) {
    width: 50vw;
  }
}
</style>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  text-align: center;

  .join-button {
    width: 100%;
  }
}
</style>
