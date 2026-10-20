import { ref } from "vue";
import { defineStore } from "pinia";
import { usernameKey } from "@/modules/constants";

/**
 * The name this visitor confirmed, handed from Home or the deck chooser
 * to the room. Room state itself lives in `createRoomState`, owned by
 * the room session — it ends with the visit, so it has no store.
 */
export const useRootStore = defineStore("root", () => {
  /**
   * The current user's username. Empty until confirmed this visit, which
   * is what makes a direct room link ask for a name.
   */
  const username = ref<string>("");

  /**
   * Update the username and save it in localStorage.
   * @param name The username to set.
   */
  function setUsername(name: string) {
    username.value = name;
    localStorage.setItem(usernameKey, name);
  }

  /**
   * Forget the confirmed name for this visit. localStorage keeps it, so
   * the next join form is prefilled.
   */
  function clearUsername() {
    username.value = "";
  }

  return { username, setUsername, clearUsername };
});
