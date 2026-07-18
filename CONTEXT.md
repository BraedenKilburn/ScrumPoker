# ScrumPoker — Domain Context

Glossary of domain terms. Grown lazily: a term is added when a piece of
work actually resolves it (see `docs/agents/domain.md`), not speculatively.

## Snapshot

The authoritative view of a room a client receives on join or reconnect
(`joinRoomSuccess`) and after a visibility change (`voteStatus`). A
snapshot is always built **for one recipient**.

While a round is hidden, a snapshot **masks** every *other* member's cast
vote to `"?"` — it reveals *whether* they have voted, never *what*. An
uncast vote reads as `null`. The recipient's **own** vote is never masked
from them: they cast it, so echoing it back reveals nothing they don't
already know, and it lets the client treat the snapshot as complete
rather than reconciling against local state. Reactions are live-only and
never appear in a snapshot.

Builders live in `backend/src/roomSnapshots.ts`. The masking rule is a
single private `maskVote` in the RoomManager, and there is **no accessor
for raw votes** — masking cannot be bypassed by a future caller.

## Broadcast audience

Every server→client message is addressed to exactly one of four
audiences, named by the `RoomBroadcaster` seam
(`backend/src/roomBroadcaster.ts`):

| Audience              | Method         | Meaning                                        |
| --------------------- | -------------- | ---------------------------------------------- |
| **room**              | `toRoom`       | every member, including the actor              |
| **room except actor** | `toRoomExcept` | everyone but the member whose action caused it |
| **member**            | `toUser`       | one named member, via the connection registry  |
| **each member**       | `toEachMember` | a separately-built payload per member          |
| **sender**            | `reply`        | the actor's own socket only (errors, notices)  |

**Each member** exists because a [Snapshot](#snapshot) differs by
recipient — it carries that member's own vote unmasked — so it cannot be
a single shared broadcast. `voteStatus` always uses it, on both reveal
and hide, so the audience isn't re-decided case by case.

**Actor**: the member whose client message triggered the broadcast.

The actor-exclusion on `votesCleared` is deliberate: the actor's client
applies the clear locally and stays silent (no new-round sound cue for
one's own clear). Whether to normalize this asymmetry so every action
echoes to its actor is an open question tracked in the issue tracker.
