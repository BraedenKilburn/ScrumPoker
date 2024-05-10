import { ref } from "vue"
import { defineStore } from "pinia"

export const useRootStore = defineStore('root', () => {
  const socketId = ref('')
  const username = ref('')

  return {
    socketId,
    username
  }
})