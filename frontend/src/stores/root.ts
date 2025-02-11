import Cookies from 'js-cookie'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { usernameKey } from '@/modules/constants'

/**
 * A user in the room.
 */
export type User = {
  username: string
  point_estimate?: string
}

export const useRootStore = defineStore('root', () => {
  /**
   * The current user's username.
   */
  const username = ref<string>('')

  /**
   * Update the username and save it in localStorage.
   * @param name The username to set.
   */
  function setUsername(name: string) {
    username.value = name
    Cookies.set(usernameKey, name)
  }

  /**
   * Whether the current user is the admin
   */
  const isAdmin = ref(false)
  const adminUsername = ref('')

  /**
   * Set the admin of the room.
   * @param newAdmin The admin's username.
   */
  function setAdmin(newAdmin: string) {
    adminUsername.value = newAdmin
    isAdmin.value = newAdmin === username.value
  }

  /**
   * All participants in the room.
   */
  const participants = ref<Map<string, string | undefined>>(new Map())

  /**
   * Adds a participant to the room.
   * @param participant The participant to add.
   */
  function addParticipant(participant: User) {
    participants.value.set(participant.username, participant.point_estimate)
  }

  /**
   * Removes a participant from the room and returns the removed participant.
   * @param username The username of the participant to remove.
   */
  function removeParticipant(username: string) {
    participants.value.delete(username)
  }

  /**
   * The current user's point estimate.
   */
  const pointEstimate = ref<string | undefined>(undefined)

  /**
   * Set the user's point estimate.
   * @param pointEstimate The point estimate to set.
   */
  function setUserPointEstimate(estimate?: string) {
    if (!username.value) return

    const vote = estimate ?? pointEstimate.value
    participants.value.set(username.value, vote)
    pointEstimate.value = vote
  }

  /**
   * Set a participant's point estimate.
   * @param username The username of the participant.
   * @param pointEstimate The point estimate to set.
   */
  function setParticipantPointEstimate(username: string, pointEstimate?: string) {
    participants.value.set(username, pointEstimate)
  }

  /**
   * The visibility of the votes.
   */
  const votesVisible = ref(false)

  /**
   * If the users are allowed to change their votes.
   */
  const votesLocked = ref(false)

  /**
   * Clear the votes of all participants.
   */
  function clearVotes() {
    pointEstimate.value = undefined
    participants.value.forEach((_, username) => {
      participants.value.set(username, undefined)
    })
    votesVisible.value = false
    votesLocked.value = false
  }

  /**
   * Reset the store to its initial state.
   */
  function $reset() {
    participants.value = new Map()
    username.value = ''
    isAdmin.value = false
    adminUsername.value = ''
    votesLocked.value = false
  }

  return {
    username,
    setUsername,

    isAdmin,
    adminUsername,
    setAdmin,

    participants,
    addParticipant,
    removeParticipant,

    pointEstimate,
    setUserPointEstimate,
    setParticipantPointEstimate,

    votesVisible,
    clearVotes,

    votesLocked,

    $reset
  }
})
