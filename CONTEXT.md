# ScrumPoker — Domain Context

Glossary of domain terms. Grown lazily: a term is added when a piece of
work actually resolves it (see `docs/agents/domain.md`), not speculatively.

## Membership

A name on a room's roster (`room.users`). Membership is what other
members see: `userJoined`, `userLeft`, `participantRemoved` and
`roomClosed` all announce a membership change, and a
[Snapshot](#snapshot) lists exactly the current members.

Membership transitions live in one place, `backend/src/roomMembership.ts`
— `arrive`, `depart` and `evict`. That module is the only thing that
sequences the room roster, the connection registry and the disconnect
registry together; nothing else may mutate more than one of them.

## Presence

Whether a member holds a live socket right now. Presence is *not*
membership: the two disagree for the length of a
[Grace period](#grace-period), and that gap is the whole reason both
facts are tracked. `ConnectionManager` owns presence; `RoomManager` owns
membership.

A member who is absent still counts as a member — they hold their seat,
their vote, and their name against a would-be duplicate.

## Grace period

The 30 seconds after an unexpected socket close during which a member
keeps their membership without presence. Announced with
`userDisconnected` on entry and, if it expires, `userLeft`. Reconnecting
inside the window restores presence and replays a
[Snapshot](#snapshot); nothing about the member's membership changed, so
the room hears `userReconnected` rather than a rejoin.

Held by `DisconnectManager`, whose timers run through an injectable
scheduler so expiry is testable by advancing a clock rather than
sleeping.

## Departure reason

Why a socket closed, and therefore what the room is told. Derived from
the close frame **and** room state — an admin's departure closes the room
whatever reason their client sent, so this is not a pure decode of the
frame.

| Reason          | Trigger                        | Effect                             |
| --------------- | ------------------------------ | ---------------------------------- |
| `usernameTaken` | close code `4001`              | silent — nothing was registered    |
| `adminLeft`     | departing member is the admin  | `roomClosed`, room destroyed       |
| `evicted`       | reason `Removed by admin`      | silent — `evict` already announced |
| `left`          | reason `User left room`        | `userLeft`, no grace period        |
| `lost`          | anything else                  | `userDisconnected` → grace period  |

The order matters and is asserted: `adminLeft` is checked before the
reason strings. The two reason strings and the close codes are the wire
contract (`CloseReason`, `CloseCode` in `shared/types.ts`) — both the
frontend and the backend import them rather than repeating literals,
because a typo would silently reclassify a departure.

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
