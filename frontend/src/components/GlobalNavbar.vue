<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { isDarkMode, setTheme } from '@/modules/darkMode'

// Room ID display
const route = useRoute()
const roomId = computed(() => route.params.id)

// Dark Mode Toggle
const icon = computed(() => (isDarkMode.value ? 'pi pi-sun' : 'pi pi-moon'))
function toggleDarkMode() {
  setTheme(isDarkMode.value ? 'theme-light' : 'theme-dark')
}
</script>

<template>
  <nav>
    <router-link :to="{ name: 'Home' }" class="logo"> Scrum Poker </router-link>
    <p v-if="roomId">
      Room ID: <strong>{{ roomId }}</strong>
    </p>
    <VButton :icon severity="secondary" rounded @click="toggleDarkMode()" />
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
