<script setup lang="ts">
import Toast from 'primevue/toast'
import { keepTheme } from '@/modules/darkMode'
import GlobalNavbar from '@/components/GlobalNavbar.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

keepTheme()
</script>

<template>
  <GlobalNavbar />
  <RouterView class="main" />
  <GlobalFooter />
  <Toast />
</template>

<style scoped lang="scss">
.main {
  min-height: calc(100vh - var(--nav-height) - var(--footer-height));
}
</style>
