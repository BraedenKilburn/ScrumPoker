<script setup lang="ts">
import Cookies from 'js-cookie'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usernameKey } from '@/modules/constants'
import { useRootStore } from '@/stores/root'

// Username
const username = ref(Cookies.get(usernameKey) ?? '')

// Room ID
const roomId = ref('')

const store = useRootStore()
const router = useRouter()

/**
 * If the username and room ID are not empty, join the room.
 */
function join() {
  if (!roomId.value || !username.value) return

  store.setUsername(username.value)
  store.addParticipant({
    username: username.value,
    point_estimate: undefined
  })

  router.push({ name: 'Room', params: { id: roomId.value.toLowerCase() } })
}

// Disable the join button if the room ID or username is empty.
const disabled = computed(() => !roomId.value || !username.value)
</script>

<template>
  <main>
    <div class="intro">
      <h1>Welcome to Scrum&nbsp;Poker</h1>
      <p>Enter a username and a room ID to join an existing room or create a new room.</p>
    </div>
    <form @submit.prevent="join">
      <VCard class="home-card">
        <template #content>
          <FloatLabel variant="on">
            <InputText
              id="username"
              v-model.trim="username"
              autocomplete="off"
              size="large"
              autofocus
            />
            <label for="username">Username</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputText id="roomId" v-model.trim="roomId" autocomplete="off" size="large" />
            <label for="roomId">Room ID</label>
          </FloatLabel>
        </template>

        <template #footer>
          <VButton type="submit" class="join-button" label="Join Room" :disabled />
        </template>
      </VCard>
    </form>
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
