<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router'
import { Socket } from 'socket.io-client';
import Toast from 'primevue/toast'
import { useToast } from 'primevue/useToast/UseToast';
import GlobalNavbar from '@/components/GlobalNavbar.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

const links = useRouter().getRoutes()
  .sort((a, b) => (a.meta.order as number) - (b.meta.order as number))

const toast = useToast();
const socket = inject<Socket>('socket')
socket?.on('notification', (message: string) => {
  toast.add({
    severity: 'info',
    summary: 'Notification',
    detail: message,
    life: 3000,
  });
});

socket?.on('error', (message: string) => {
  toast.add({
    severity: 'error',
    summary: 'Error',
    detail: message,
    life: 3000,
  });
});
</script>

<template>
  <GlobalNavbar :links />
  <RouterView class="main" />
  <GlobalFooter />
  <Toast />
</template>

<style scoped lang="scss">
.main {
  min-height: calc(100vh - var(--nav-height) - var(--footer-height));
}
</style>
