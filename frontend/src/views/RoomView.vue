<script setup lang="ts">
import { computed, ref } from "vue";
import PMessage from "primevue/message";
import { onBeforeRouteLeave } from "vue-router";
import type { DeckId, ParticipantRole } from "@shared/types";
import spadeUrl from "@/assets/spade.svg";
import ParticipantCard from "@/components/ParticipantCard.vue";
import RoleToggle from "@/components/RoleToggle.vue";
import VotingProgress from "@/components/VotingProgress.vue";
import VoteDistribution from "@/components/VoteDistribution.vue";
import ParticipantManageSheet from "@/components/ParticipantManageSheet.vue";
import SpectatorChip from "@/components/SpectatorChip.vue";
import HandStrip from "@/components/HandStrip.vue";
import ReactionBar from "@/components/ReactionBar.vue";
import ReactionFeed from "@/components/ReactionFeed.vue";
import DeckChooserView from "@/views/DeckChooserView.vue";
import { useRoomSession } from "@/composables/useRoomSession";
import { deckTone } from "@/modules/deckTone";

const props = defineProps<{ id: string }>();
const {
  adminSheetOpen,
  canReact,
  changeDeck,
  connectionStatus,
  copiedRoomLink,
  deck,
  deckLabel,
  hasVotes,
  isAdmin,
  isMissingUsername,
  isSpectator,
  joinAsSpectator,
  members,
  pointEstimate,
  points,
  reactionBursts,
  reactionFeed,
  reactionsRateLimited,
  roomId,
  soundCuesEnabled,
  spectatorMembers,
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
  sendReaction,
  startNewRound,
  teardownRoomSession,
  toggleSoundCues,
  toggleVoteLock,
  toggleVoteVisibility,
  vote,
} = useRoomSession(props.id);

// The change-deck chooser renders as an overlay (not a route) so the
// socket stays alive — leaving the Room route disconnects and an admin
// disconnect destroys the room.
const deckChooserOpen = ref(false);

// The join dialog's RoleToggle speaks roles; the session tracks the
// boolean it feeds into the connect URL.
const joinRole = computed<ParticipantRole>({
  get: () => (joinAsSpectator.value ? "spectator" : "voter"),
  set: (role) => (joinAsSpectator.value = role === "spectator"),
});

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
            <span class="id-text">{{ roomId.toUpperCase() }}</span>
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
          class="ghost-btn sound"
          :aria-label="soundCuesEnabled ? 'Turn sound cues off' : 'Turn sound cues on'"
          :aria-pressed="soundCuesEnabled"
          @click="toggleSoundCues"
        >
          <i :class="soundCuesEnabled ? 'pi pi-volume-up' : 'pi pi-volume-off'" />
          <span class="hide-mobile">{{ soundCuesEnabled ? "Sound on" : "Sound off" }}</span>
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
            <span v-if="isSpectator" class="spectating-chip">
              <i class="pi pi-eye" aria-hidden="true" />
              SPECTATING
            </span>
            <span class="vote-pill" :class="{ revealed: votesVisible }">
              <span class="dot" />
              {{ votesVisible ? "Votes revealed" : `${votedCount}/${totalCount} voted` }}
            </span>
            <span v-if="spectatorMembers.length" class="watching-pill">
              <i class="pi pi-eye" aria-hidden="true" />
              {{ spectatorMembers.length }} watching
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

          <div v-if="spectatorMembers.length" class="spectator-row">
            <SpectatorChip
              v-for="s in spectatorMembers"
              :key="s.name"
              :name="s.name"
              :is-current-user="s.isCurrentUser"
            />
          </div>

          <div class="reaction-burst-layer" aria-hidden="true">
            <span
              v-for="reaction in reactionBursts"
              :key="reaction.id"
              class="reaction-burst"
              :style="{ left: `${reaction.x}%` }"
            >
              {{ reaction.emoji }}
            </span>
          </div>
        </section>

        <aside class="rail">
          <VoteDistribution v-if="votesVisible" :members="members" :cards="points" />
          <div v-else-if="isSpectator" class="spectator-notice surface-panel">
            <i class="pi pi-eye" aria-hidden="true" />
            <p>You're spectating this round — no card to play, just watching the team vote.</p>
            <span class="progress">{{ votedCount }}/{{ totalCount }} voted</span>
          </div>
          <VotingProgress v-else :members="members" :spectators="spectatorMembers" />
          <ReactionBar
            :disabled="!canReact"
            :rate-limited="reactionsRateLimited"
            @react="sendReaction"
          />
          <ReactionFeed v-if="reactionFeed.length" :items="reactionFeed" />
        </aside>
      </div>

      <PMessage
        v-if="votesLocked && !isAdmin && !isSpectator"
        severity="info"
        size="small"
        class="lock-banner"
      >
        <template #icon><i class="pi pi-lock" /></template>
        The votes are locked.
      </PMessage>

      <!-- Spectators have no hand of cards at all — nothing to play. -->
      <div v-if="!isSpectator" class="hand-wrap">
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
      :spectators="spectatorMembers"
      @transfer-admin="makeAdmin"
      @remove-participant="handleRemoveParticipant"
    />

    <VDialog :closable="false" :visible="isMissingUsername" modal class="join-dialog">
      <template #header>
        <div class="join-header">
          <div class="logo-tile" aria-hidden="true">
            <img :src="spadeUrl" alt="" />
          </div>
          <span class="join-title">Welcome to {{ roomId.toUpperCase() }}</span>
        </div>
      </template>
      <p class="join-copy">Enter a name, then choose how you'd like to join.</p>
      <form class="join-form" @submit.prevent="join">
        <div class="join-field">
          <label class="join-label" for="username">Your name</label>
          <InputText
            id="username"
            v-model="usernameModel"
            autocomplete="off"
            autofocus
            placeholder="e.g. Braeden"
          />
        </div>
        <div class="join-field">
          <span class="join-label">Join as</span>
          <RoleToggle v-model="joinRole" />
          <p class="role-hint">
            {{
              joinRole === "spectator"
                ? "You'll watch the room without a hand of cards — no vote, no pressure."
                : "You'll get a hand of cards and count toward the room's vote."
            }}
          </p>
        </div>
        <VButton
          class="join-cta"
          :class="{ spectating: joinRole === 'spectator' }"
          :label="joinRole === 'spectator' ? 'Join as spectator' : 'Join & vote'"
          :disabled="!usernameModel"
          type="submit"
        />
      </form>
    </VDialog>
  </main>
</template>

<style lang="scss">
/* Unscoped: the dialog teleports to <body>, outside this component's
   scope attribute — same pattern as ParticipantManageSheet's drawer. */
.p-dialog.join-dialog {
  width: min(24rem, calc(100vw - 2rem));
}
</style>

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
  gap: clamp(0.5rem, 2vw, 1rem);
  padding: 0.85rem clamp(0.75rem, 3vw, 1.75rem);
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
      // Drop the deck chip to its own line instead of colliding with
      // the header actions when the viewport is narrow.
      flex-wrap: wrap;
      min-width: 0;
      align-items: center;
      gap: 0.15rem 0.5rem;
      font-family: ui-monospace, monospace;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.04em;

      .id-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
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
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  // Icon-only below 768px (labels are .hide-mobile) — slim the padding
  // so four buttons leave the brand text some room.
  padding: 0.5rem 0.6rem;
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

  &.sound {
    // Hover only wobbles the off-state icon (like .invite) so the
    // pop below isn't overridden while the cursor is still on the button.
    &:hover .pi-volume-off {
      animation: sound-ring 650ms ease-in-out;
    }

    .pi-volume-up {
      animation: check-pop 350ms ease-out;
    }
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

  @media (min-width: 768px) {
    padding: 0.5rem 0.85rem;

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

@keyframes sound-ring {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }

  20% {
    transform: rotate(-14deg) scale(1.12);
  }

  45% {
    transform: rotate(10deg) scale(1.06);
  }

  70% {
    transform: rotate(-6deg) scale(1);
  }

  85% {
    transform: rotate(3deg) scale(1);
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
    gap: 0.5rem;
    flex-wrap: wrap;
    position: relative;
    z-index: 3;
  }

  .spectating-chip,
  .watching-pill,
  .vote-pill {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 2rem;
    padding-block: 0;
  }

  .spectating-chip {
    gap: 0.4rem;
    padding-inline: 0.7rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--p-violet-400) 18%, transparent);
    color: var(--p-violet-400);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;

    .pi {
      font-size: 0.75rem;
    }
  }

  .watching-pill {
    gap: 0.4rem;
    padding-inline: 0.7rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--p-content-background) 70%, black);
    border: 1px solid var(--p-content-border-color);
    font-size: 0.72rem;
    color: var(--p-text-muted-color);

    .pi {
      font-size: 0.72rem;
    }
  }

  .vote-pill {
    gap: 0.5rem;
    padding-inline: 0.85rem;
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
    position: relative;
    z-index: 1;
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

  .reaction-burst-layer {
    position: absolute;
    z-index: 2;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  .reaction-burst {
    position: absolute;
    bottom: 16%;
    filter: drop-shadow(0 0.35rem 0.65rem rgb(0 0 0 / 45%));
    font-size: clamp(1.75rem, 3.5vw, 2.4rem);
    line-height: 1;
    will-change: transform, opacity;
    animation: reaction-float 1.8s ease-out forwards;
  }

  .empty {
    color: var(--p-text-muted-color);
    text-align: center;
    padding: 2rem 0;
  }

  // A clearly different tier than the voter cards: compact chips, no
  // vote slot, no suspense.
  .spectator-row {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
}

.spectator-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  padding: 1.25rem;
  text-align: center;

  .pi-eye {
    font-size: 1.1rem;
    color: var(--p-text-muted-color);
  }

  p {
    margin: 0;
    color: var(--p-text-muted-color);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .progress {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: var(--p-text-color);
  }
}

.rail {
  display: none;

  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    align-self: start;
  }
}

@keyframes reaction-float {
  0% {
    opacity: 0;
    transform: translate(-50%, 1.25rem) scale(0.65) rotate(-8deg);
  }

  16% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.08) rotate(3deg);
  }

  72% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -11rem) scale(1.25) rotate(9deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .board .reaction-burst {
    opacity: 1;
    transform: translateX(-50%);
    animation: none;
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

/* ===== Join dialog ===== */
.join-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;

  .logo-tile {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: linear-gradient(135deg, var(--p-primary-color), var(--p-amber-400));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    img {
      width: 1rem;
      height: 1rem;
    }
  }

  .join-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// The dialog teleports to <body>, so :deep() from this component can't
// reach PrimeVue-rendered wrappers — but elements authored here keep
// their scope attribute, so plain scoped selectors still apply to them.
.join-copy {
  margin: 0 0 1.15rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  line-height: 1.5;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.join-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

  :deep(.p-inputtext) {
    width: 100%;
  }
}

.join-label {
  color: var(--p-text-muted-color);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.role-hint {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  line-height: 1.5;
}

.join-cta {
  width: 100%;
  min-height: 3rem;
  border: 0;
  border-radius: 0.7rem;
  background: linear-gradient(110deg, var(--p-primary-color), var(--p-green-400));
  color: var(--p-primary-contrast-color);
  font-weight: 700;
  transition: background 0.2s ease;

  &.spectating {
    background: linear-gradient(
      110deg,
      var(--p-violet-400),
      color-mix(in srgb, var(--p-violet-400) 70%, var(--p-amber-400))
    );
    color: var(--p-surface-950);
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
