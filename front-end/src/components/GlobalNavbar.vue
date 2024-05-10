<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, type RouteRecordRaw } from 'vue-router'

defineProps<{
  links: RouteRecordRaw[]
}>()

const route = useRoute()
const roomId = computed(() => route.params.id)
</script>

<template>
  <nav>
    <router-link
      :to="{ name: 'Home' }"
      class="logo"
    >
      <i class="pi pi-home" />
      Scrum Poker
    </router-link>
    <p v-if="roomId">Room ID: <strong>{{ roomId }}</strong></p>
  </nav>
</template>

<style scoped lang="scss">
nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--nav-height);
  padding: 1rem;

  i {
    margin-right: 0.5rem;
  }
}
</style>