<script setup lang="ts">
import { ref } from "vue";
import PMessage from "primevue/message";
import { onBeforeRouteLeave } from "vue-router";
import type { DeckId } from "@shared/types";
import spadeUrl from "@/assets/spade.svg";
import ParticipantCard from "@/components/ParticipantCard.vue";
import VotingProgress from "@/components/VotingProgress.vue";
import VoteDistribution from "@/components/VoteDistribution.vue";
import ParticipantManageSheet from "@/components/ParticipantManageSheet.vue";
import HandStrip from "@/components/HandStrip.vue";
import DeckChooserView from "@/views/DeckChooserView.vue";
import { useRoomSession } from "@/composables/useRoomSession";
import { deckTone } from "@/modules/deckTone";
import { changeDeck } from "@/modules/socket";

const props = defineProps<{ id: string }>();
const {
  adminSheetOpen,
  connectionStatus,
  copiedRoomLink,
  deck,
  deckLabel,
  hasVotes,
  isAdmin,
  isMissingUsername,
  members,
  pointEstimate,
  points,
  roomId,
  totalCount,
  usernameModel,
  votedCount,
  votesLocked,
  votesVisible,
  clearAllVotes,
  clearMyVote,
  copyRoomLink,
  handleRemoveParticipant,
  join,
  leaveRoom,
  makeAdmin,
  startNewRound,
  teardownRoomSession,
  toggleVoteLock,
  toggleVoteVisibility,
  vote,
} = useRoomSession(props.id);

// The change-deck chooser renders as an overlay (not a route) so the
// socket stays alive — leaving the Room route disconnects and an admin
// disconnect destroys the room.
const deckChooserOpen = ref(false);

function handleDeckConfirm(newDeck: DeckId) {
  if (newDeck !== deck.value) changeDeck(newDeck);
  deckChooserOpen.value = false;
}

onBeforeRouteLeave(() => {
  teardownRoomSession();
});
</script>

<template>
  <main>
    <header class="room-header">
      <div class="brand">
        <div class="logo-tile" aria-hidden="true">
          <img :src="spadeUrl" alt="" />
        </div>
        <div class="brand-text">
          <span class="overline">ROOM</span>
          <span class="room-id">
            {{ roomId.toUpperCase() }}
            <span class="deck-chip">{{ deckLabel }} deck</span>
          </span>
        </div>
      </div>
      <div class="header-actions">
        <button
          v-if="isAdmin"
          class="ghost-btn change-deck"
          aria-label="Change deck"
          @click="deckChooserOpen = true"
        >
          <i class="pi pi-pencil" />
          <span class="hide-mobile">Change deck</span>
        </button>
        <button
          class="ghost-btn invite"
          :aria-label="copiedRoomLink ? 'Copied' : 'Invite'"
          @click="copyRoomLink"
        >
          <i :class="copiedRoomLink ? 'pi pi-check' : 'pi pi-share-alt'" />
          <span class="hide-mobile">{{ copiedRoomLink ? "Copied" : "Invite" }}</span>
        </button>
        <button class="ghost-btn leave" aria-label="Leave room" @click="leaveRoom">
          <i class="pi pi-sign-out" />
          <span class="hide-mobile">Leave</span>
        </button>
      </div>
    </header>

    <div class="room-body">
      <PMessage v-if="connectionStatus === 'reconnecting'" severity="warn" class="reconnect-banner">
        <template #icon>
          <i class="pi pi-spin pi-spinner" />
        </template>
        Connection lost. Attempting to reconnect...
      </PMessage>

      <section v-if="isAdmin" class="control-bar surface-panel">
        <div class="control-meta">
          <span class="admin-chip"><i class="pi pi-crown" /> ADMIN</span>
          <span class="status">
            <span class="label-short">
              {{ votesVisible ? "Votes revealed" : `${votedCount}/${totalCount} voted` }}
            </span>
            <span class="label-full">
              {{ votesVisible ? "votes revealed" : `${votedCount} of ${totalCount} voted` }}
            </span>
          </span>
          <button class="secondary manage" @click="adminSheetOpen = true">
            <i class="pi pi-users" />
            Manage
          </button>
        </div>
        <div class="control-actions">
          <button
            v-if="!votesVisible"
            class="cta reveal"
            :disabled="!hasVotes"
            @click="toggleVoteVisibility"
          >
            <i class="pi pi-eye" />
            <span class="label-full">Reveal Votes</span>
            <span class="label-short">Reveal</span>
            <span class="muted">{{ votedCount }}/{{ totalCount }}</span>
          </button>
          <button v-else class="cta new-round" @click="startNewRound">
            <i class="pi pi-refresh" />
            New Round
          </button>
          <button
            class="secondary lock-toggle"
            :class="{ on: votesLocked }"
            :disabled="!hasVotes"
            @click="toggleVoteLock"
          >
            <i :class="votesLocked ? 'pi pi-lock' : 'pi pi-unlock'" />
            {{ votesLocked ? "Locked" : "Lock" }}
          </button>
          <button class="secondary danger" :disabled="!hasVotes" @click="clearAllVotes">
            <i class="pi pi-trash" />
            <span class="label-full">Clear all</span>
            <span class="label-short">Clear</span>
          </button>
        </div>
      </section>

      <div class="layout">
        <section class="board surface-panel">
          <div class="board-header">
            <span class="vote-pill" :class="{ revealed: votesVisible }">
              <span class="dot" />
              {{ votesVisible ? "Votes revealed" : `${votedCount}/${totalCount} voted` }}
            </span>
          </div>
          <div v-if="members.length" class="grid">
            <ParticipantCard
              v-for="m in members"
              :key="m.name"
              :name="m.name"
              :point="m.point"
              :band="deckTone(m.point, points)"
              :is-admin="m.isAdmin"
              :is-current-user="m.isCurrentUser"
              :revealed="votesVisible"
              :can-manage-admin="isAdmin && !m.isCurrentUser && !m.isAdmin"
              :can-remove="isAdmin && !m.isCurrentUser"
              @transfer-admin="makeAdmin(m.name)"
              @remove="handleRemoveParticipant(m.name)"
            />
          </div>
          <p v-else class="empty">Waiting for participants…</p>
        </section>

        <aside class="rail">
          <VoteDistribution v-if="votesVisible" :members="members" :cards="points" />
          <VotingProgress v-else :members="members" />
        </aside>
      </div>

      <PMessage v-if="votesLocked && !isAdmin" severity="info" size="small" class="lock-banner">
        <template #icon><i class="pi pi-lock" /></template>
        The votes are locked.
      </PMessage>

      <div class="hand-wrap">
        <HandStrip
          :points="points"
          :current="pointEstimate"
          :disabled="votesLocked"
          @vote="vote"
          @clear="clearMyVote"
        />
      </div>
    </div>

    <div v-if="deckChooserOpen" class="deck-overlay">
      <DeckChooserView
        :id="roomId"
        mode="change"
        :current-deck="deck"
        @close="deckChooserOpen = false"
        @confirm="handleDeckConfirm"
      />
    </div>

    <ParticipantManageSheet
      v-if="isAdmin"
      v-model:visible="adminSheetOpen"
      :members="members"
      @transfer-admin="makeAdmin"
      @remove-participant="handleRemoveParticipant"
    />

    <VDialog :closable="false" :visible="isMissingUsername" modal header="Welcome">
      <p>Please enter a username to join the room.</p>
      <form @submit.prevent="join">
        <InputText id="username" v-model="usernameModel" autocomplete="off" autofocus />
        <VButton label="Submit" :disabled="!usernameModel" type="submit" />
      </form>
    </VDialog>
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

.room-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(0.75rem, 2.5vw, 1.75rem);
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  min-height: 0;
}

.reconnect-banner,
.lock-banner {
  width: 100%;
}

/* ===== Header ===== */
.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem clamp(1rem, 3vw, 1.75rem);
  background: color-mix(in srgb, var(--p-content-background) 88%, black);
  border-bottom: 1px solid var(--p-content-border-color);

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .logo-tile {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.6rem;
    background: linear-gradient(135deg, var(--p-primary-color), var(--p-amber-400));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
    flex-shrink: 0;

    img {
      width: 1.25rem;
      height: 1.25rem;
    }
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    min-width: 0;

    .overline {
      font-size: 0.65rem;
      letter-spacing: 0.14em;
      color: var(--p-text-muted-color);
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .room-id {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: ui-monospace, monospace;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.04em;
    }

    .deck-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.6rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      background: color-mix(in srgb, var(--p-content-background) 70%, black);
      color: var(--p-text-muted-color);
      font-family: inherit;
      font-size: 0.68rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  border-radius: 0.6rem;
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--p-text-color);
  }

  &.invite {
    &:hover .pi-share-alt {
      animation: share-spark 650ms;
    }

    .pi-check {
      animation: check-pop 350ms ease-out;
    }
  }

  &.change-deck:hover .pi {
    animation: pencil-scribble 550ms ease-in-out;
  }

  &.leave:hover .pi {
    animation: leave-scoot 0.5s ease-in-out;
  }

  &.leave:hover {
    color: var(--p-red-400);
    border-color: var(--p-red-400);
  }

  .hide-mobile {
    display: none;
  }

  @media (min-width: 480px) {
    .hide-mobile {
      display: inline;
    }
  }
}

/* ===== Control bar ===== */
.control-bar {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem;

  .admin-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: color-mix(in srgb, var(--p-amber-400) 15%, transparent);
    color: var(--p-amber-400);
    min-height: 2rem;
    padding: 0 0.75rem;
    border-radius: 0.6rem;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .control-meta,
  .control-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
  }

  .control-meta {
    min-width: 0;
  }

  .control-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    border: none;
    border-radius: 0.7rem;
    padding: 0.65rem 0.85rem;
    font: inherit;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;

    .muted {
      opacity: 0.8;
      font-weight: 500;
    }

    &.reveal {
      color: #052e1a;
      background: linear-gradient(135deg, var(--p-emerald-400), var(--p-green-400));
      box-shadow: 0 6px 20px color-mix(in srgb, var(--p-emerald-400) 30%, transparent);

      &:hover:not(:disabled) .pi {
        animation: eye-blink 300ms ease-in-out;
      }
    }

    &.new-round {
      color: #2b1a04;
      background: linear-gradient(135deg, var(--p-amber-400), var(--p-amber-500));

      &:hover:not(:disabled) .pi {
        animation: refresh-spin-pop 500ms linear;
      }
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }
  }

  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    border: 1px solid var(--p-content-border-color);
    background: transparent;
    color: var(--p-text-color);
    padding: 0.55rem 0.85rem;
    border-radius: 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: var(--p-text-color);
    }

    &.on {
      color: var(--p-amber-400);
      border-color: color-mix(in srgb, var(--p-amber-400) 60%, transparent);
    }

    &.danger:hover:not(:disabled) {
      color: var(--p-red-400);
      border-color: var(--p-red-400);
    }

    &.danger {
      &:hover:not(:disabled) .pi {
        animation: trash-wiggle 550ms;
      }
    }

    &.manage {
      &:hover:not(:disabled) .pi {
        animation: users-hop 550ms;
      }
    }

    &.lock-toggle {
      &:hover:not(:disabled) .pi {
        animation: lock-click-shut 550ms;
      }
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .status {
    color: var(--p-text-muted-color);
    font-size: 0.8rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .label-full {
    display: none;
  }

  .label-short {
    display: inline;
  }

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;

    .control-meta,
    .control-actions {
      display: contents;
    }

    .admin-chip {
      align-self: stretch;
      min-height: auto;
    }

    .cta {
      min-height: auto;
      padding: 0.65rem 1rem;
    }

    .secondary {
      min-height: auto;
    }

    .status {
      order: 20;
      margin-left: auto;
    }

    .secondary.manage {
      display: none;
    }

    .label-full {
      display: inline;
    }

    .label-short {
      display: none;
    }
  }
}

@keyframes eye-blink {
  50% {
    transform: scaleY(0.12);
  }
}

@keyframes lock-click-shut {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }

  28% {
    transform: translateY(-2px) rotate(-10deg) scale(1.08);
  }

  58% {
    transform: translateY(1px) rotate(6deg) scaleY(0.88);
  }

  78% {
    transform: translateY(0) rotate(0deg) scaleY(1.08);
  }

  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
}

@keyframes refresh-spin-pop {
  to {
    transform: rotate(360deg);
  }
}

@keyframes trash-wiggle {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  25% {
    transform: translateY(-1px) rotate(-9deg);
  }

  50% {
    transform: translateY(1px) rotate(8deg) scaleY(0.94);
  }

  75% {
    transform: translateY(0) rotate(-5deg);
  }
}

@keyframes users-hop {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  35% {
    transform: translateY(-3px) scale(1.08);
  }

  65% {
    transform: translateY(1px) scale(0.96);
  }
}

@keyframes share-spark {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }

  35% {
    transform: translate(2px, -2px) rotate(-12deg) scale(1.12);
  }

  70% {
    transform: translate(-1px, 1px) rotate(8deg) scale(0.96);
  }
}

@keyframes check-pop {
  0% {
    transform: scale(0.65) rotate(-12deg);
  }

  70% {
    transform: scale(1.18) rotate(4deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes pencil-scribble {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }

  20% {
    transform: translate(-1.5px, 1px) rotate(-16deg);
  }

  40% {
    transform: translate(1.5px, -0.5px) rotate(-10deg);
  }

  60% {
    transform: translate(-1px, 1px) rotate(-15deg);
  }

  80% {
    transform: translate(1px, 0) rotate(-5deg);
  }
}

@keyframes leave-scoot {
  0%,
  100% {
    transform: translateX(0);
  }

  45% {
    transform: translateX(3px) scale(1.08);
  }

  70% {
    transform: translateX(-1px) scale(0.98);
  }
}

/* ===== Layout (board + rail) ===== */
.layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 1fr) 18rem;
  }
}

.board {
  position: relative;
  background:
    radial-gradient(
      ellipse at 50% 50%,
      color-mix(in srgb, var(--p-blue-500) 12%, transparent) 0%,
      transparent 65%
    ),
    color-mix(in srgb, var(--p-content-background) 88%, black);
  padding: 1.25rem 1rem;
  min-height: 12rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .board-header {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .vote-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--p-content-background) 70%, black);
    border: 1px solid var(--p-content-border-color);
    font-size: 0.8rem;
    color: var(--p-text-color);

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--p-emerald-400);
      box-shadow: 0 0 8px var(--p-emerald-400);
    }

    &.revealed .dot {
      background: var(--p-amber-400);
      box-shadow: 0 0 8px var(--p-amber-400);
    }
  }

  .grid {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: center;
    align-items: center;
    gap: 0.4rem;

    @media (min-width: 500px) {
      gap: 0.85rem;
    }

    > * {
      flex: 0 0 calc((100% - 0.4rem * 2) / 3);
      min-width: 0;
      box-sizing: border-box;

      @media (min-width: 500px) {
        flex-basis: 8.5rem;
      }

      @media (min-width: 768px) {
        flex-basis: 10rem;
      }
    }
  }

  .empty {
    color: var(--p-text-muted-color);
    text-align: center;
    padding: 2rem 0;
  }
}

.rail {
  display: none;

  @media (min-width: 1024px) {
    display: block;
  }
}

/* ===== Hand strip ===== */
.hand-wrap {
  position: sticky;
  bottom: 0.5rem;
  z-index: 5;
}

/* ===== Change-deck overlay ===== */
.deck-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  overflow-y: auto;
  background: var(--p-content-background);
}

/* ===== Welcome dialog ===== */
:deep(.p-dialog-content) {
  p {
    margin-top: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
