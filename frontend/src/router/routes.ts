import type { AsyncComponentLoader } from "vue";
import type { RouteRecordRaw } from "vue-router";
import HomeView from "@/views/HomeView.vue";

const roomView: AsyncComponentLoader = () => import("@/views/RoomView.vue");
const deckChooserView: AsyncComponentLoader = () => import("@/views/DeckChooserView.vue");
const NotFoundView: AsyncComponentLoader = () => import("@/views/NotFoundView.vue");

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
