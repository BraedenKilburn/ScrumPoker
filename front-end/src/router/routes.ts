import type { AsyncComponentLoader } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const roomView: AsyncComponentLoader = () => import(/* webpackChunkName: "room" */ '@/views/RoomView.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/room/:id',
    name: 'Room',
    component: roomView,
    props: true,
  }
]

export default routes