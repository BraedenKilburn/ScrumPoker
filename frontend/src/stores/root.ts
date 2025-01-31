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
   * All participants in the room.
   */
  const participants = ref<Map<string, string | undefined>>(new Map())

  /**
   * The current user's username.
   */
  const username = ref<string>('')

  /**
   * The current user's point estimate.
   */
  const pointEstimate = ref<string | undefined>(undefined)

  /**
   * Update the username and save it in localStorage.
   * @param name The username to set.
   */
  function setUsername(name: string) {
    username.value = name
    Cookies.set(usernameKey, name)
  }

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
   * Clear the votes of all participants.
   */
  function clearVotes() {
    pointEstimate.value = undefined
    participants.value.forEach((_, username) => {
      participants.value.set(username, undefined)
    })
    votesVisible.value = false
  }

  /**
   * Reset the store to its initial state.
   */
  function $reset() {
    participants.value = new Map()
    username.value = ''
  }

  return {
    username,
    setUsername,

    participants,
    addParticipant,
    removeParticipant,

    pointEstimate,
    setUserPointEstimate,
    setParticipantPointEstimate,

    votesVisible,
    clearVotes,

    $reset
  }
})
