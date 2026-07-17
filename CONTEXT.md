# ScrumPoker — Domain Context

Glossary of domain terms. Grown lazily: a term is added when a piece of
work actually resolves it (see `docs/agents/domain.md`), not speculatively.

## Snapshot

The authoritative view of a room a client receives on join or reconnect
(`joinRoomSuccess`) and after a visibility change (`voteStatus`). While
votes are hidden, a snapshot **masks** every cast vote to `"?"` — it
reveals *whether* a member has voted, never *what*. Reactions are
live-only and never appear in a snapshot.

Builders live in `backend/src/roomSnapshots.ts`; the masking rule itself
lives in the RoomManager's vote getters.

## Broadcast audience

Every server→client message is addressed to exactly one of four
audiences, named by the `RoomBroadcaster` seam
(`backend/src/roomBroadcaster.ts`):

| Audience              | Method         | Meaning                                        |
| --------------------- | -------------- | ---------------------------------------------- |
| **room**              | `toRoom`       | every member, including the actor              |
| **room except actor** | `toRoomExcept` | everyone but the member whose action caused it |
| **member**            | `toUser`       | one named member, via the connection registry  |
| **sender**            | `reply`        | the actor's own socket only (errors, notices)  |

**Actor**: the member whose client message triggered the broadcast.

The actor-exclusion on `votesCleared` is deliberate: the actor's client
applies the clear locally and stays silent (no new-round sound cue for
one's own clear). Whether to normalize this asymmetry so every action
echoes to its actor is an open question tracked in the issue tracker.
