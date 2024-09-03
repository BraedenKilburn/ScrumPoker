<script setup lang="ts">
import { useRouter } from 'vue-router'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast';
import { keepTheme } from '@/modules/darkMode';
import { connectWebSocket, type Message } from '@/modules/socket';
import { useRootStore } from '@/stores/root';
import GlobalNavbar from '@/components/GlobalNavbar.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

const toast = useToast();
function addNotification(message: string) {
  toast.add({
    severity: 'info',
    summary: 'Notification',
    detail: message,
    life: 3000,
  });
}

const router = useRouter();
const store = useRootStore();
function handleWebSocketMessage(data: Message) {
  console.log('Received message:', data);

  switch (data.message) {
    case 'ExistingUsers':
      store.participants = data.users ?? [];
      break;
    case 'UserJoined':
      if (!data.user) return;
      store.addParticipant(data.user);
      addNotification(`${data.user.username} joined the room`);
      break;
    case 'UserLeft': {
      if (!data.connection_id) return;
      const user = store.removeParticipant(data.connection_id);
      addNotification(`${user?.username ?? 'A user'} left the room`);
      break;
    }
    case 'UserVoted':
      if (!data.connection_id || data.point_estimate === undefined) return;
      store.setParticipantPointEstimate(data.connection_id, data.point_estimate);
      break;
    case 'RevealVotes':
      if (!data.point_estimates) return;
      store.revealVotes(data.point_estimates);
      break;
    case 'HideVotes':
      store.hideVotes();
      break;
    case 'VotesCleared':
      store.clearVotes();
      break;
    case 'notification':
      if (!data.details) return;
      addNotification(data.details);
      break;
    case 'error':
      if (!data.details) return;
      if (data.details === 'Username is already taken in this room') {
        router.push({ name: 'Home' });
      }
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: data.details,
        life: 3000,
      });
      break;
    default:
      console.error('Unknown message:', data);
  }
}

connectWebSocket(
  import.meta.env.VITE_SOCKET_URL,
  handleWebSocketMessage,
);

keepTheme();
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
