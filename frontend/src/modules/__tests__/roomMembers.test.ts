import { describe, expect, it } from "vitest";
import { decks } from "@shared/types";
import { createRoomMembers, createSpectatorMembers } from "../roomMembers";

const fibonacci = decks.fibonacci.cards;
const tshirt = decks.tshirt.cards;

/** Participants as the store holds them: username -> vote (undefined = not voted). */
function participants(entries: Record<string, string | undefined>) {
  return new Map(Object.entries(entries));
}

const order = (members: Array<{ name: string }>) => members.map((m) => m.name);

describe("createRoomMembers", () => {
  describe("member shape", () => {
    it("flags the admin and the current user, and carries the vote through", () => {
      const members = createRoomMembers(
        participants({ alice: "5", bob: undefined }),
        "alice",
        "bob",
        true,
        fibonacci,
      );

      expect(members).toEqual([
        { name: "alice", point: "5", isAdmin: true, isCurrentUser: false },
        { name: "bob", point: undefined, isAdmin: false, isCurrentUser: true },
      ]);
    });

    it("flags nobody when the admin and current user are not in the room", () => {
      const members = createRoomMembers(participants({ alice: "5" }), "ghost", "nobody", true, fibonacci);

      expect(members[0]).toEqual({
        name: "alice",
        point: "5",
        isAdmin: false,
        isCurrentUser: false,
      });
    });

    it("returns an empty list for an empty room", () => {
      expect(createRoomMembers(participants({}), "alice", "alice", true, fibonacci)).toEqual([]);
    });
  });

  describe("while votes are hidden", () => {
    it("sorts alphabetically, ignoring votes entirely", () => {
      const members = createRoomMembers(
        participants({ carol: "8", alice: undefined, bob: "1" }),
        "alice",
        "alice",
        false,
        fibonacci,
      );

      expect(order(members)).toEqual(["alice", "bob", "carol"]);
    });

    it("is unaffected by masked values from the server", () => {
      // Hidden rounds arrive with others masked to "?" and our own vote real.
      const members = createRoomMembers(
        participants({ carol: "?", alice: "5", bob: "?" }),
        "carol",
        "alice",
        false,
        fibonacci,
      );

      expect(order(members)).toEqual(["alice", "bob", "carol"]);
    });
  });

  describe("once votes are revealed", () => {
    it("puts members who voted ahead of those who did not", () => {
      const members = createRoomMembers(
        participants({ alice: undefined, bob: "5", carol: undefined, dave: "3" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      // Voters by deck rank, then non-voters alphabetically.
      expect(order(members)).toEqual(["dave", "bob", "alice", "carol"]);
    });

    it("orders numeric votes by deck rank, not lexicographically", () => {
      const members = createRoomMembers(
        participants({ alice: "13", bob: "5", carol: "21", dave: "8" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      // Lexicographically this would be "13", "21", "5", "8" — wrong.
      expect(order(members)).toEqual(["bob", "dave", "alice", "carol"]);
      expect(members.map((m) => m.point)).toEqual(["5", "8", "13", "21"]);
    });

    it("orders a non-numeric scale by deck rank", () => {
      const members = createRoomMembers(
        participants({ alice: "XL", bob: "S", carol: "M", dave: "XS" }),
        "alice",
        "alice",
        true,
        tshirt,
      );

      // Lexicographically this would be "L", "M", "S", "XL", "XS" — wrong.
      expect(members.map((m) => m.point)).toEqual(["XS", "S", "M", "XL"]);
    });

    it("sinks special tokens below real estimates despite their deck position", () => {
      // "?" sits at index 0 of every deck, so rank alone would sort it
      // first — being off-scale has to win over rank.
      const members = createRoomMembers(
        participants({ alice: "?", bob: "8", carol: "1" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(members.map((m) => m.point)).toEqual(["1", "8", "?"]);
    });

    it("keeps voters ahead of non-voters whichever order they arrived in", () => {
      // Exercises both directions of the voted/not-voted comparison: with
      // only one orientation covered, a flipped sign slips through.
      const voterFirst = createRoomMembers(
        participants({ bob: "5", alice: undefined }),
        "alice",
        "alice",
        true,
        fibonacci,
      );
      const voterLast = createRoomMembers(
        participants({ alice: undefined, bob: "5" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(order(voterFirst)).toEqual(["bob", "alice"]);
      expect(order(voterLast)).toEqual(["bob", "alice"]);
    });

    it("produces the same order regardless of how participants arrived", () => {
      const args = ["alice", "alice", true, fibonacci] as const;
      const expected = ["dave", "bob", "erin", "alice", "carol"];

      expect(
        order(
          createRoomMembers(
            participants({ alice: undefined, bob: "5", carol: undefined, dave: "3", erin: "?" }),
            ...args,
          ),
        ),
      ).toEqual(expected);
      expect(
        order(
          createRoomMembers(
            participants({ erin: "?", dave: "3", carol: undefined, bob: "5", alice: undefined }),
            ...args,
          ),
        ),
      ).toEqual(expected);
    });

    it("still ranks special tokens above members who did not vote", () => {
      const members = createRoomMembers(
        participants({ alice: undefined, bob: "?" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(order(members)).toEqual(["bob", "alice"]);
    });

    it("sinks a value that is not in the room's deck", () => {
      // e.g. a vote cast before the admin switched decks.
      const members = createRoomMembers(
        participants({ alice: "99", bob: "5" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(order(members)).toEqual(["bob", "alice"]);
    });

    it("falls back to names when two votes are both off-deck", () => {
      // Both rank as Infinity; the comparator must not produce NaN.
      const members = createRoomMembers(
        participants({ zara: "98", alice: "99" }),
        "zara",
        "zara",
        true,
        fibonacci,
      );

      expect(order(members)).toEqual(["alice", "zara"]);
    });

    it("breaks ties on equal votes alphabetically", () => {
      const members = createRoomMembers(
        participants({ carol: "5", alice: "5", bob: "5" }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(order(members)).toEqual(["alice", "bob", "carol"]);
    });

    it("breaks ties between non-voters alphabetically", () => {
      const members = createRoomMembers(
        participants({ carol: undefined, alice: undefined }),
        "alice",
        "alice",
        true,
        fibonacci,
      );

      expect(order(members)).toEqual(["alice", "carol"]);
    });
  });
});

describe("createSpectatorMembers", () => {
  it("sorts spectators alphabetically and flags admin and current user", () => {
    const spectators = createSpectatorMembers(new Set(["carol", "alice", "bob"]), "carol", "bob");

    expect(spectators).toEqual([
      { name: "alice", isAdmin: false, isCurrentUser: false },
      { name: "bob", isAdmin: false, isCurrentUser: true },
      { name: "carol", isAdmin: true, isCurrentUser: false },
    ]);
  });

  it("returns an empty list when nobody is spectating", () => {
    expect(createSpectatorMembers(new Set(), "alice", "alice")).toEqual([]);
  });
});
