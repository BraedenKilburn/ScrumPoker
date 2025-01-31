<script setup lang="ts">
import Cookies from 'js-cookie'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usernameKey } from '@/modules/constants'
import {
  connectWebSocket,
  clearVotes,
  hideVotes,
  revealVotes,
  submitVote,
  type Message
} from '@/modules/socket'
import { useRootStore } from '@/stores/root'
import PointAccordion from '@/components/PointAccordion.vue'

const toast = useToast()
function addNotification(message: string) {
  toast.add({
    severity: 'info',
    summary: 'Notification',
    detail: message,
    life: 3000
  })
}

const router = useRouter()
const store = useRootStore()
const { username, votesVisible, participants } = storeToRefs(store)

function handleWebSocketMessage({ type, data }: Message) {
  switch (type) {
    case 'joinRoomSuccess':
      participants.value = new Map(Object.entries(data.participants))
      break
    case 'userJoined':
      if (!data.username) return
      store.addParticipant({ username: data.username })
      addNotification(`${data.username} joined the room`)
      break
    case 'userLeft': {
      if (!data.username) return
      store.removeParticipant(data.username)
      addNotification(`${data.username ?? 'A user'} left the room`)
      break
    }
    case 'userVoted':
      if (!data.username) return
      store.setParticipantPointEstimate(data.username, data.vote)
      break
    case 'voteStatus':
      if (!data.votes) return
      participants.value = new Map(Object.entries(data.votes))
      votesVisible.value = data.revealed

      // If we're hiding votes, set the user's point estimate
      // to it's initial value.
      if (!data.revealed) store.setUserPointEstimate()
      break
    case 'votesCleared':
      store.clearVotes()
      votesVisible.value = false
      break
    case 'roomClosed':
      router.push({ name: 'Home' })
      break
    case 'notification':
      if (!data.details) return
      addNotification(data.details)
      break
    case 'error':
      if (!data.details) return
      if (data.details === 'Username is already taken in this room') {
        router.push({ name: 'Home' })
      }
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: data.details,
        life: 3000
      })
      break
    default:
      console.error('Unknown message:', data)
  }
}

// Room ID
const props = defineProps<{ id: string }>()
const roomId = computed(() => props.id?.toLowerCase() ?? '')
if (!roomId.value) {
  addNotification('No room ID provided')
  router.push({ name: 'Home' })
}

// WebSocket URL
const wsUrl = computed(() => {
  const url = new URL(import.meta.env.VITE_SOCKET_URL)
  url.searchParams.append('roomId', roomId.value)
  return url;
})

let socket: WebSocket
const isMissingUsername = computed(() => !username.value)
if (!isMissingUsername.value) socket = connectWebSocket(wsUrl.value, handleWebSocketMessage)

// If entered room without a username (e.g., from a link),
// prompt the user to enter a username and join the room.
const usernameModel = ref(Cookies.get(usernameKey) ?? '')
function join() {
  if (!roomId.value || !usernameModel.value) return
  store.setUsername(usernameModel.value)
  socket = connectWebSocket(wsUrl.value, handleWebSocketMessage)
}

/**
 * All members in the room with their point estimates.
 * Used to display the table of members and their votes.
 */
const members = computed(() => {
  return Array.from(participants.value.entries())
    .map(([name, point]) => ({ name, point }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/**
 * Check if at least one member has voted.
 */
const hasVotes = computed(() => members.value.some(({ point }) => point != null))

/**
 * Toggle the visibility of all votes.
 */
function toggleVoteVisibility() {
  if (votesVisible.value) hideVotes()
  else revealVotes()
}

// Available points for voting
const points = ref(['40', '21', '13', '8', '5', '3', '2', '1', '?'])

/**
 * Submit a vote for the user.
 * @param point The point estimate to vote for.
 */
function vote(point?: string) {
  store.setUserPointEstimate(point)
  submitVote({ vote: point })
}

/**
 * Clear the user's vote.
 */
function clearMyVote() {
  store.pointEstimate = undefined
  vote();
}

/**
 * Clear all votes in the room.
 */
function clearAllVotes() {
  clearVotes()
  store.clearVotes()
}

const copiedRoomLink = ref(false)
/**
 * Copy the room link to the clipboard.
 */
function copyRoomLink() {
  navigator.clipboard.writeText(window.location.href)
  copiedRoomLink.value = true
}

// Reset the store and close the WebSocket connection when navigating away
onBeforeRouteLeave(() => {
  socket.close()
  store.$reset()
})
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
        :disabled="!votesVisible && !hasVotes"
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
      <DataTable :value="members" row-hover>
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
          @click="clearMyVote"
        />
        <VButton
          label="Clear All Votes"
          severity="danger"
          :disabled="!hasVotes"
          @click="clearAllVotes"
        />
      </div>
    </div>

    <PointAccordion />

    <VDialog
      :closable="false"
      :visible="isMissingUsername"
      modal
      header="Welcome"
    >
      <p>Please enter a username to join the room.</p>
      <InputText id="username" v-model="usernameModel" autocomplete="off" autofocus />
      <template #footer>
        <VButton label="Submit" :disabled="!usernameModel" @click="join" />
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
  padding: 0 1rem;

  h1 {
    margin: 0;
  }

  .actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .container {
    width: 100%;
    display: flex;
    justify-content: space-around;
    gap: 1rem;

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
