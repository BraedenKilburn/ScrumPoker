import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { decks } from "@shared/types";
import { createRoomState } from "../roomState";

type Snapshot = Parameters<ReturnType<typeof createRoomState>["adoptSnapshot"]>[0];

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    participants: {},
    spectators: [],
    admin: "admin",
    locked: false,
    revealed: false,
    deck: "fibonacci",
    ...overrides,
  };
}

function roomAs(me: string) {
  const username = ref(me);
  return { username, room: createRoomState({ me: username }) };
}

describe("adoptSnapshot", () => {
  it("replaces the room with the snapshot and adopts our own vote from it", () => {
    const { room } = roomAs("alice");

    room.adoptSnapshot(
      snapshot({
        participants: { alice: "5", bob: "?", carol: null },
        spectators: ["watcher"],
        admin: "bob",
        locked: true,
        deck: "tshirt",
      }),
    );

    expect(room.members.value).toEqual([
      { name: "alice", point: "5", isAdmin: false, isCurrentUser: true },
      { name: "bob", point: "?", isAdmin: true, isCurrentUser: false },
      { name: "carol", point: undefined, isAdmin: false, isCurrentUser: false },
    ]);
    expect(room.spectatorMembers.value).toEqual([
      { name: "watcher", isAdmin: false, isCurrentUser: false },
    ]);
    expect(room.ownVote.value).toBe("5");
    expect(room.votesLocked.value).toBe(true);
    expect(room.votesVisible.value).toBe(false);
    expect(room.deck.value).toBe("tshirt");
    expect(room.isAdmin.value).toBe(false);
  });
});

describe("adoptVoteSnapshot", () => {
  it("reports a reveal only when a hidden round becomes revealed", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: "5", bob: "?" } }));

    expect(room.adoptVoteSnapshot({ revealed: true, votes: { alice: "5", bob: "8" } })).toBe(true);
    expect(room.members.value.map((m) => m.point)).toEqual(["5", "8"]);
    expect(room.votesVisible.value).toBe(true);

    // A repeated reveal (e.g. reconnect replay) is not a new reveal.
    expect(room.adoptVoteSnapshot({ revealed: true, votes: { alice: "5", bob: "8" } })).toBe(false);
    expect(room.adoptVoteSnapshot({ revealed: false, votes: { alice: "5", bob: "?" } })).toBe(
      false,
    );
    expect(room.votesVisible.value).toBe(false);
  });

  it("adopts our own vote, including a reset we missed", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: "5" } }));

    room.adoptVoteSnapshot({ revealed: false, votes: { alice: null } });

    expect(room.ownVote.value).toBeUndefined();
  });
});

describe("me", () => {
  it("derives admin and current-user flags from whoever me is now", () => {
    const { username, room } = roomAs("");
    room.adoptSnapshot(snapshot({ participants: { alice: null }, admin: "alice" }));
    expect(room.isAdmin.value).toBe(false);

    username.value = "alice";

    expect(room.isAdmin.value).toBe(true);
    expect(room.members.value[0].isCurrentUser).toBe(true);
  });
});

describe("castOwnVote", () => {
  it("applies the vote optimistically and returns what to send", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: null, bob: null } }));

    expect(room.castOwnVote("5")).toEqual({ vote: "5" });
    expect(room.ownVote.value).toBe("5");
    expect(room.members.value[0].point).toBe("5");
  });

  it("withdraws the vote when the same card is played again", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: "5" } }));

    expect(room.castOwnVote("5")).toEqual({ vote: undefined });
    expect(room.ownVote.value).toBeUndefined();
    expect(room.members.value[0].point).toBeUndefined();
  });

  it("refuses while votes are locked or when spectating", () => {
    const locked = roomAs("alice").room;
    locked.adoptSnapshot(snapshot({ participants: { alice: "3" }, locked: true }));
    expect(locked.castOwnVote("5")).toBeNull();
    expect(locked.ownVote.value).toBe("3");

    const watching = roomAs("watcher").room;
    watching.adoptSnapshot(snapshot({ spectators: ["watcher"] }));
    expect(watching.castOwnVote("5")).toBeNull();
    expect(watching.members.value).toEqual([]);
  });
});

describe("withdrawOwnVote", () => {
  it("clears our vote and returns what to send", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: "5" } }));

    expect(room.withdrawOwnVote()).toEqual({ vote: undefined });
    expect(room.ownVote.value).toBeUndefined();
    expect(room.members.value[0].point).toBeUndefined();
  });

  it("refuses while votes are locked", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: "5" }, locked: true }));

    expect(room.withdrawOwnVote()).toBeNull();
    expect(room.ownVote.value).toBe("5");
  });
});

describe("memberVoted", () => {
  it("records another member's vote as the room may see it", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: null, bob: null } }));

    room.memberVoted("bob", "?");

    expect(room.members.value[1].point).toBe("?");
  });

  it("keeps our optimistic vote when its masked echo comes back", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: null } }));
    room.castOwnVote("5");

    room.memberVoted("alice", "?");

    expect(room.ownVote.value).toBe("5");
    expect(room.members.value[0].point).toBe("5");
  });
});

/** A revealed, locked round with votes cast, ready to be reset. */
function roundInProgress(me: string) {
  const { room } = roomAs(me);
  room.adoptSnapshot(
    snapshot({
      participants: { admin: "3", alice: "5", bob: "8" },
      revealed: true,
      locked: true,
    }),
  );
  return room;
}

function expectFreshRound(room: ReturnType<typeof createRoomState>) {
  expect(room.members.value.map((m) => m.point)).toEqual([undefined, undefined, undefined]);
  expect(room.ownVote.value).toBeUndefined();
  expect(room.votesVisible.value).toBe(false);
  expect(room.votesLocked.value).toBe(false);
}

describe("round reset", () => {
  it("clearRound resets the round locally for the admin who cleared it", () => {
    const room = roundInProgress("admin");

    room.clearRound();

    expectFreshRound(room);
  });

  it("roundCleared by another admin resets the round and reports it", () => {
    const room = roundInProgress("alice");

    expect(room.roundCleared("admin")).toBe(true);

    expectFreshRound(room);
  });

  it("roundCleared acknowledges our own clear without replaying it", () => {
    const room = roundInProgress("admin");
    room.clearRound();
    room.adoptVoteSnapshot({ revealed: false, votes: { admin: null, alice: "?", bob: null } });

    expect(room.roundCleared("admin")).toBe(false);

    // The vote alice cast after our clear survives the late echo.
    expect(room.members.value.find((m) => m.name === "alice")?.point).toBe("?");
  });

  it("deckChanged switches the deck and resets the round", () => {
    const room = roundInProgress("alice");

    room.deckChanged("tshirt");

    expect(room.deck.value).toBe("tshirt");
    expect(room.points.value).toEqual(decks.tshirt.cards);
    expectFreshRound(room);
  });
});

describe("membership", () => {
  it("seats an arriving voter without a vote and an arriving spectator off the board", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: null } }));

    room.memberArrived("bob", "voter");
    room.memberArrived("watcher", "spectator");

    expect(room.members.value.map((m) => [m.name, m.point])).toEqual([
      ["alice", undefined],
      ["bob", undefined],
    ]);
    expect(room.spectatorMembers.value.map((s) => s.name)).toEqual(["watcher"]);
  });

  it("removes a departing voter or spectator", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(
      snapshot({ participants: { alice: null, bob: "5" }, spectators: ["watcher"] }),
    );

    room.memberLeft("bob");
    room.memberLeft("watcher");

    expect(room.members.value.map((m) => m.name)).toEqual(["alice"]);
    expect(room.spectatorMembers.value).toEqual([]);
  });

  it("follows the admin role and the vote lock", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(snapshot({ participants: { alice: null, bob: null }, admin: "bob" }));

    room.adminChanged("alice");
    room.lockChanged(true);

    expect(room.isAdmin.value).toBe(true);
    expect(room.members.value[0].isAdmin).toBe(true);
    expect(room.votesLocked.value).toBe(true);
  });

  it("hands the admin role to a spectator without seating them", () => {
    const { room } = roomAs("watcher");
    room.adoptSnapshot(
      snapshot({ participants: { alice: null }, spectators: ["watcher"], admin: "alice" }),
    );

    room.adminChanged("watcher");

    expect(room.isAdmin.value).toBe(true);
    expect(room.isSpectator.value).toBe(true);
    expect(room.isVoter.value).toBe(false);
    expect(room.spectatorMembers.value).toEqual([
      { name: "watcher", isAdmin: true, isCurrentUser: true },
    ]);
    expect(room.members.value).toEqual([
      { name: "alice", point: undefined, isAdmin: false, isCurrentUser: false },
    ]);
  });
});

// Ported from the old roomMembers helper: ordering is now observed
// through the room's `members` read, fed by a snapshot.
describe("member ordering", () => {
  function membersOf(
    participants: Record<string, string | null>,
    { revealed = true, deck = "fibonacci" as Snapshot["deck"], admin = "alice", me = "alice" } = {},
  ) {
    const { room } = roomAs(me);
    room.adoptSnapshot(snapshot({ participants, revealed, deck, admin }));
    return room.members.value;
  }
  const order = (members: Array<{ name: string }>) => members.map((m) => m.name);

  it("flags nobody when the admin and current user are not in the room", () => {
    expect(membersOf({ alice: "5" }, { admin: "ghost", me: "nobody" })[0]).toEqual({
      name: "alice",
      point: "5",
      isAdmin: false,
      isCurrentUser: false,
    });
  });

  it("is empty for an empty room", () => {
    expect(membersOf({})).toEqual([]);
  });

  describe("while votes are hidden", () => {
    it("sorts alphabetically, ignoring votes entirely", () => {
      expect(order(membersOf({ carol: "8", alice: null, bob: "1" }, { revealed: false }))).toEqual([
        "alice",
        "bob",
        "carol",
      ]);
    });

    it("is unaffected by masked values from the server", () => {
      // Hidden rounds arrive with others masked to "?" and our own vote real.
      const members = membersOf({ carol: "?", alice: "5", bob: "?" }, { revealed: false });
      expect(order(members)).toEqual(["alice", "bob", "carol"]);
    });
  });

  describe("once votes are revealed", () => {
    it("puts members who voted ahead of those who did not", () => {
      // Voters by deck rank, then non-voters alphabetically.
      expect(order(membersOf({ alice: null, bob: "5", carol: null, dave: "3" }))).toEqual([
        "dave",
        "bob",
        "alice",
        "carol",
      ]);
    });

    it("orders numeric votes by deck rank, not lexicographically", () => {
      // Lexicographically this would be "13", "21", "5", "8" — wrong.
      const members = membersOf({ alice: "13", bob: "5", carol: "21", dave: "8" });
      expect(members.map((m) => m.point)).toEqual(["5", "8", "13", "21"]);
    });

    it("orders a non-numeric scale by deck rank", () => {
      // Lexicographically this would be "M", "S", "XL", "XS" — wrong.
      const members = membersOf(
        { alice: "XL", bob: "S", carol: "M", dave: "XS" },
        { deck: "tshirt" },
      );
      expect(members.map((m) => m.point)).toEqual(["XS", "S", "M", "XL"]);
    });

    it("sinks special tokens below real estimates despite their deck position", () => {
      // "?" sits at index 0 of every deck, so rank alone would sort it
      // first — being off-scale has to win over rank.
      const members = membersOf({ alice: "?", bob: "8", carol: "1" });
      expect(members.map((m) => m.point)).toEqual(["1", "8", "?"]);
    });

    it("keeps voters ahead of non-voters whichever order they arrived in", () => {
      // Exercises both directions of the voted/not-voted comparison: with
      // only one orientation covered, a flipped sign slips through.
      expect(order(membersOf({ bob: "5", alice: null }))).toEqual(["bob", "alice"]);
      expect(order(membersOf({ alice: null, bob: "5" }))).toEqual(["bob", "alice"]);
    });

    it("produces the same order regardless of how participants arrived", () => {
      const expected = ["dave", "bob", "erin", "alice", "carol"];
      expect(
        order(membersOf({ alice: null, bob: "5", carol: null, dave: "3", erin: "?" })),
      ).toEqual(expected);
      expect(
        order(membersOf({ erin: "?", dave: "3", carol: null, bob: "5", alice: null })),
      ).toEqual(expected);
    });

    it("still ranks special tokens above members who did not vote", () => {
      expect(order(membersOf({ alice: null, bob: "?" }))).toEqual(["bob", "alice"]);
    });

    it("sinks a value that is not in the room's deck", () => {
      // e.g. a vote cast before the admin switched decks.
      expect(order(membersOf({ alice: "99", bob: "5" }))).toEqual(["bob", "alice"]);
    });

    it("falls back to names when two votes are both off-deck", () => {
      // Both rank as Infinity; the comparator must not produce NaN.
      expect(order(membersOf({ zara: "98", alice: "99" }))).toEqual(["alice", "zara"]);
    });

    it("breaks ties on equal votes alphabetically", () => {
      expect(order(membersOf({ carol: "5", alice: "5", bob: "5" }))).toEqual([
        "alice",
        "bob",
        "carol",
      ]);
    });

    it("breaks ties between non-voters alphabetically", () => {
      expect(order(membersOf({ carol: null, alice: null }))).toEqual(["alice", "carol"]);
    });
  });

  it("sorts spectators alphabetically and flags admin and current user", () => {
    const { room } = roomAs("bob");
    room.adoptSnapshot(snapshot({ spectators: ["carol", "alice", "bob"], admin: "carol" }));

    expect(room.spectatorMembers.value).toEqual([
      { name: "alice", isAdmin: false, isCurrentUser: false },
      { name: "bob", isAdmin: false, isCurrentUser: true },
      { name: "carol", isAdmin: true, isCurrentUser: false },
    ]);
  });
});

describe("tally", () => {
  it("counts voters only, so spectators never join the X of Y", () => {
    const { room } = roomAs("alice");
    room.adoptSnapshot(
      snapshot({ participants: { alice: null, bob: "?" }, spectators: ["watcher"], admin: "bob" }),
    );

    expect(room.votedCount.value).toBe(1);
    expect(room.totalCount.value).toBe(2);
    expect(room.hasVotes.value).toBe(true);
    expect(room.adminUsername.value).toBe("bob");

    room.roundCleared("bob");

    expect(room.votedCount.value).toBe(0);
    expect(room.hasVotes.value).toBe(false);
  });
});

describe("seat", () => {
  it("holds no hand and accepts no vote until a snapshot seats us as a voter", () => {
    const { room } = roomAs("alice");

    expect(room.isVoter.value).toBe(false);
    expect(room.castOwnVote("5")).toBeNull();

    room.adoptSnapshot(snapshot({ participants: { alice: null } }));

    expect(room.isVoter.value).toBe(true);
    expect(room.castOwnVote("5")).toEqual({ vote: "5" });
  });

  it("never seats a spectator as a voter", () => {
    const { room } = roomAs("watcher");
    room.adoptSnapshot(snapshot({ spectators: ["watcher"] }));

    expect(room.isVoter.value).toBe(false);
  });
});
