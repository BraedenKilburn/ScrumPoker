<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import Toast from "primevue/toast";
import { keepDarkTheme } from "@/modules/darkMode";
import GlobalNavbar from "@/components/GlobalNavbar.vue";
import GlobalFooter from "@/components/GlobalFooter.vue";

keepDarkTheme();

const route = useRoute();
const isRoomView = computed(() => route.name === "Room");
</script>

<template>
  <GlobalNavbar v-if="!isRoomView" />
  <RouterView class="main" :class="{ 'main--no-nav': isRoomView }" />
  <GlobalFooter v-if="!isRoomView" />
  <Toast />
</template>

<style scoped lang="scss">
.main {
  min-height: calc(100vh - var(--nav-height) - var(--footer-height));

  &--no-nav {
    min-height: 100vh;
  }
}
</style>
