import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { usernameKey } from '@/modules/constants'

/**
 * A user in the room.
 */
export type User = {
  connection_id: string
  username: string
  point_estimate: string | null
  room_id?: string
  isAdmin?: boolean
}

export const useRootStore = defineStore('root', () => {
  /**
   * All participants in the room.
   */
  const participants = ref<User[]>([])

  /**
   * The current user's username.
   */
  const username = ref<string>('')

  /**
   * Whether the current user is an admin.
   */
  const isAdmin = ref(false)

  /**
   * The current user.
   */
  const user = computed(() => {
    return participants.value.find((participant) => participant.username === username.value)
  })

  /**
   * Update the username and save it in localStorage.
   * @param name The username to set.
   */
  function setUsername(name: string) {
    username.value = name
    localStorage.setItem(usernameKey, name)
  }

  /**
   * Adds a participant to the room.
   * @param participant The participant to add.
   * @param isAdmin Whether the participant is the room admin.
   */
  function addParticipant(participant: User, isAdmin = false) {
    participants.value.push({ ...participant, isAdmin })
  }

  /**
   * Removes a participant from the room and returns the removed participant.
   * @param username The username of the participant to remove.
   * @returns The removed participant object, or `null` if no participant was found.
   */
  function removeParticipant(username: string): User | null {
    const index = participants.value.findIndex((participant) => participant.username === username)
    if (index !== -1) {
      const [removedParticipant] = participants.value.splice(index, 1) // Remove and return the participant
      return removedParticipant
    }
    return null // Return null if no participant was found
  }

  /**
   * Set the user's point estimate.
   * @param pointEstimate The point estimate to set.
   */
  function setUserPointEstimate(pointEstimate: string | null) {
    if (user.value) user.value.point_estimate = pointEstimate
  }

  /**
   * Set a participant's point estimate.
   * @param connectionId The connection ID of the participant.
   * @param pointEstimate The point estimate to set.
   */
  function setParticipantPointEstimate(connectionId: string, pointEstimate: string | null) {
    const participant = participants.value.find(
      (participant) => participant.connection_id === connectionId
    )
    if (participant) participant.point_estimate = pointEstimate
  }

  /**
   * The visibility of the votes.
   */
  const votesVisible = ref(false)

  /**
   * For each user, set their actual point estimate. Then, set the visibility of the votes.
   * @param users Reveal the votes of the given users with their point estimates.
   */
  function revealVotes(users: User[]) {
    for (const user of users) {
      const participant = participants.value.find(
        (participant) => participant.connection_id === user.connection_id
      )
      if (participant) participant.point_estimate = user.point_estimate
    }
    votesVisible.value = true
  }

  /**
   * Hide the votes of all participants except the current user.
   */
  function hideVotes() {
    for (const participant of participants.value) {
      if (
        participant.point_estimate !== null &&
        participant.connection_id !== user.value?.connection_id
      ) {
        participant.point_estimate = '?'
      }
    }
    votesVisible.value = false
  }

  /**
   * Clear the votes of all participants.
   */
  function clearVotes() {
    participants.value.forEach((participant) => {
      participant.point_estimate = null
    })
    votesVisible.value = false
  }

  /**
   * Reset the store to its initial state.
   */
  function $reset() {
    participants.value = []
    username.value = ''
  }

  return {
    username,
    user,
    isAdmin,
    setUsername,

    participants,
    addParticipant,
    removeParticipant,

    setUserPointEstimate,
    setParticipantPointEstimate,

    votesVisible,
    revealVotes,
    hideVotes,
    clearVotes,

    $reset
  }
})
