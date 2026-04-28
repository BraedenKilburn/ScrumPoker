<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

// Room ID display
const route = useRoute();
const roomId = computed(() => route.params.id);
</script>

<template>
  <nav>
    <router-link :to="{ name: 'Home' }" class="logo"> Scrum Poker </router-link>
    <div class="nav-links">
      <p v-if="roomId">
        Room ID: <strong>{{ roomId }}</strong>
      </p>
      <a href="https://github.com/BraedenKilburn/ScrumPoker" target="_blank" rel="noopener">
        GitHub <i class="pi pi-arrow-up-right" aria-hidden="true" />
      </a>
    </div>
  </nav>
</template>

<style scoped lang="scss">
nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--nav-height);
  padding: 1rem;

  .logo {
    font-weight: 800;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 4vw, 2rem);
  }

  p {
    margin: 0;
    color: var(--p-text-muted-color);
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--p-text-muted-color);
    font-size: 0.9rem;
  }
}
</style>
