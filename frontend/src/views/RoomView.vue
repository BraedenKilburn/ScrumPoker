<script setup lang="ts">
import Cookies from 'js-cookie'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import PMessage from 'primevue/message'
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
  transferAdmin,
  lockVotes,
  unlockVotes,
  removeParticipant,
  stopReconnection,
  type Message
} from '@/modules/socket'
import { useRootStore } from '@/stores/root'
import PointAccordion from '@/components/PointAccordion.vue'

const toast = useToast()
function addNotification(detail: string) {
  toast.add({
    severity: 'info',
    summary: 'Notification',
    detail,
    life: 3000
  })
}

function addErrorNotification(summary: string, detail: string) {
  toast.add({
    severity: 'error',
    summary,
    detail,
    life: 3000
  })
}

const router = useRouter()
const store = useRootStore()
const { username, votesVisible, participants, isAdmin, adminUsername, votesLocked } =
  storeToRefs(store)

function handleWebSocketMessage({ type, data }: Message) {
  switch (type) {
    case 'joinRoomSuccess':
      participants.value = new Map(Object.entries(data.participants))
      store.setAdmin(data.admin)
      votesLocked.value = data.locked
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
    case 'adminTransferred': {
      if (!data.newAdmin) return
      store.setAdmin(data.newAdmin)
      addNotification(`Admin role transferred to ${data.newAdmin}`)
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
    case 'voteLockStatus':
      votesLocked.value = data.locked
      break
    case 'participantRemoved':
      if (!data.participant) return
      store.removeParticipant(data.participant)
      addNotification(`${data.participant} was removed from the room by ${data.removedBy}`)
      break
    case 'youWereRemoved':
      addErrorNotification(
        'Removed from Room',
        `You were removed from the room by ${data.removedBy}`
      )
      store.$reset()
      router.push({ name: 'Home' })
      break
    case 'roomClosed':
      addErrorNotification('Room Closed', data.reason)
      store.$reset()
      router.push({ name: 'Home' })
      break
    case 'notification':
      if (!data.details) return
      addNotification(data.details)
      break
    case 'error':
      if (!data.message) return
      addErrorNotification('Error', data.message)
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
  url.searchParams.append('username', username.value)
  return url
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
    .map(([name, point]) => ({
      name,
      point,
      isAdmin: name === adminUsername.value,
      isCurrentUser: name === username.value
    }))
    .sort((a, b) => {
      // When votes are visible, sort by point estimates
      if (votesVisible.value) {
        // Handle null/undefined points - move them to the end
        if (a.point == null) return 1
        if (b.point == null) return -1

        // Special handling for '?' - move to end but before null/undefined
        if (a.point === '?' && b.point !== '?') return 1
        if (b.point === '?' && a.point !== '?') return -1

        // For numeric points, convert to numbers and compare
        const pointA = a.point === '?' ? Infinity : Number(a.point)
        const pointB = b.point === '?' ? Infinity : Number(b.point)

        // If points are different, sort by point value
        if (pointA !== pointB) return pointA - pointB
      } else {
        // When votes are hidden, show current user first
        if (a.isCurrentUser) return -1
        if (b.isCurrentUser) return 1
      }

      // For same points or when votes are hidden, sort alphabetically
      return a.name.localeCompare(b.name)
    })
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

/**
 * Toggle the lock state of votes.
 */
function toggleVoteLock() {
  if (votesLocked.value) unlockVotes()
  else lockVotes()
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
  vote()
}

/**
 * Clear all votes in the room.
 */
function clearAllVotes() {
  clearVotes()
  store.clearVotes()
}

/**
 * Make a user an admin.
 */
function makeAdmin(name: string) {
  if (!isAdmin.value || name === store.adminUsername) return
  transferAdmin(name)
}

/**
 * Remove a participant from the room.
 */
function handleRemoveParticipant(name: string) {
  if (!isAdmin.value || name === store.username) return
  removeParticipant(name)
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
  stopReconnection()
  socket.close()
  store.$reset()
})
</script>

<template>
  <main>
    <div class="actions">
      <RouterLink :to="{ name: 'Home' }">
        <VButton severity="danger" label="Leave Room" size="small" />
      </RouterLink>
      <VButton
        v-if="isAdmin"
        :label="votesVisible ? 'Hide Votes' : 'Reveal Votes'"
        severity="success"
        :disabled="!votesVisible && !hasVotes"
        size="small"
        @click="toggleVoteVisibility()"
      />
      <VButton
        v-if="isAdmin"
        :label="votesLocked ? 'Unlock Votes' : 'Lock Votes'"
        severity="info"
        :disabled="!hasVotes"
        size="small"
        :icon="votesLocked ? 'pi pi-lock' : 'pi pi-unlock'"
        @click="toggleVoteLock"
      />
      <VButton
        severity="secondary"
        label="Copy Room Link"
        :icon="copiedRoomLink ? 'pi pi-check' : 'pi pi-clipboard'"
        size="small"
        @click="copyRoomLink"
      />
    </div>

    <div class="container">
      <DataTable :value="members" row-hover>
        <Column header="Admin" style="width: 1px; text-align: center">
          <template #body="{ data }">
            <i
              :class="{
                'pi pi-star-fill': data.name === store.adminUsername,
                'pi pi-star': isAdmin && data.name !== store.adminUsername
              }"
              aria-label="Make admin"
              @click="makeAdmin(data.name)"
            />
          </template>
        </Column>
        <Column field="name" header="Name" />
        <Column field="point" header="Point" />
        <Column v-if="isAdmin" header="Remove" style="width: 1px; text-align: center">
          <template #body="{ data }">
            <i
              v-if="data.name !== store.username"
              class="pi pi-trash remove-icon"
              aria-label="Remove participant"
              @click="handleRemoveParticipant(data.name)"
            />
          </template>
        </Column>
      </DataTable>

      <div class="options">
        <PMessage v-if="votesLocked && !isAdmin" severity="info" size="small">
          <template #icon>
            <i class="pi pi-lock" />
          </template>
          The votes are locked.
        </PMessage>
        <VButton
          v-for="point in points"
          :key="point"
          :label="point.toString()"
          :disabled="votesLocked"
          size="small"
          @click="vote(point)"
        />
        <VButton
          label="Clear My Vote"
          severity="secondary"
          :disabled="!store.pointEstimate || votesLocked"
          size="small"
          @click="clearMyVote"
        />
        <VButton
          v-if="isAdmin"
          label="Clear All Votes"
          severity="danger"
          :disabled="!hasVotes"
          size="small"
          @click="clearAllVotes"
        />
      </div>
    </div>

    <PointAccordion />

    <VDialog :closable="false" :visible="isMissingUsername" modal header="Welcome">
      <p>Please enter a username to join the room.</p>
      <form @submit.prevent="join">
        <InputText id="username" v-model="usernameModel" autocomplete="off" autofocus />
        <VButton label="Submit" :disabled="!usernameModel" type="submit" />
      </form>
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
    display: grid;
    gap: 1rem;
    width: 100%;
    padding: 1rem 0;
    grid-template-columns: repeat(2, 1fr);

    :deep(.p-button) {
      width: 100%;
    }

    @media (min-width: 768px) {
      justify-content: center;
      grid-template-columns: repeat(auto-fit, minmax(150px, max-content));
    }
  }

  .container {
    width: 100%;
    display: flex;
    justify-content: space-around;
    gap: 1rem;

    .p-datatable {
      width: 80%;

      td {
        .pi-star-fill {
          color: #ffd700;
        }

        .pi-star {
          display: none;
          cursor: pointer;
        }

        &:hover {
          .pi-star {
            display: block;
          }
        }

        .pi-trash.remove-icon {
          color: red;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s ease;

          &:hover {
            opacity: 1;
          }
        }
      }
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
    margin-top: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
