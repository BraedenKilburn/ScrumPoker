import type { AsyncComponentLoader } from "vue";
import type { RouteRecordRaw } from "vue-router";
import HomeView from "@/views/HomeView.vue";

const roomView: AsyncComponentLoader = () => import("@/views/RoomView.vue");
const deckChooserView: AsyncComponentLoader = () => import("@/views/DeckChooserView.vue");
const NotFoundView: AsyncComponentLoader = () => import("@/views/NotFoundView.vue");

const intentEvents = ["pointerdown", "keydown"] as const;

/**
 * Fetch the room and deck-chooser chunks on the visitor's first tap or
 * keystroke, so joining a room waits only on the room probe and the
 * socket, not on a chunk download. Typing a name and room code takes far
 * longer than the fetch. Waiting for intent (rather than load/idle) keeps
 * the fetch off the bandwidth first paint needs on slow connections, and
 * visitors who never interact never pay for it. The loaders are the
 * routes' own, so the router reuses the already-resolved modules.
 */
export function prefetchRoomViews() {
  const prefetch = () => {
    for (const type of intentEvents) window.removeEventListener(type, prefetch, true);
    void roomView();
    void deckChooserView();
  };
  for (const type of intentEvents) {
    window.addEventListener(type, prefetch, { capture: true, passive: true });
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: HomeView,
  },
  {
    path: "/room/:id",
    name: "Room",
    component: roomView,
    props: true,
  },
  {
    path: "/room/:id/deck",
    name: "DeckChooser",
    component: deckChooserView,
    props: true,
  },
  {
    path: "/:pathMatch(.*)*",
    component: NotFoundView,
  },
];

export default routes;
