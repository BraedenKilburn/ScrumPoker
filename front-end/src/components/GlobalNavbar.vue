<script setup lang="ts">
import { ref } from 'vue'
import { type RouteRecordRaw } from 'vue-router'

defineProps<{
  links: RouteRecordRaw[]
}>()

const active = ref(false)
const closeMenu = () => (active.value = false)
</script>

<template>
  <nav>
    <router-link
      :to="{ name: 'Home' }"
      class="logo"
      @click="closeMenu"
    >
      <i class="pi pi-home" />
      Scrum Poker
    </router-link>
  </nav>
</template>

<style scoped lang="scss">
nav {
  display: flex;
  align-items: center;
  height: var(--nav-height);
  padding: 1rem;

  i {
    margin-right: 0.5rem;
  }
}
</style>