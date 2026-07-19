import { describe, expect, test } from "bun:test";
import { parseClientMessage } from "../clientMessageParser";

/** The parsed message, or a failure if the payload was rejected. */
function accepted(raw: unknown) {
  const result = parseClientMessage(typeof raw === "string" ? raw : JSON.stringify(raw));
  if (!result.ok) throw new Error(`Expected acceptance, got: ${result.reason}`);
  return result.message;
}

function rejection(raw: unknown): string {
  const result = parseClientMessage(typeof raw === "string" ? raw : JSON.stringify(raw));
  if (result.ok) throw new Error(`Expected rejection, got: ${JSON.stringify(result.message)}`);
  return result.reason;
}

describe("parseClientMessage", () => {
  describe("payload shape", () => {
    test("rejects malformed JSON", () => {
      expect(rejection("not json {")).toBe("Invalid message format. Please send valid JSON.");
    });

    test.each([
      ["a bare string", '"just a string"'],
      ["an array", "[1,2,3]"],
      ["null", "null"],
      ["a number", "42"],
    ])("rejects %s as a message", (_label, raw) => {
      expect(rejection(raw)).toBe("Unknown message type");
    });

    test.each([
      ["an unknown type", { type: "teleport" }],
      ["a non-string type", { type: 123 }],
      ["a missing type", { data: { vote: "5" } }],
    ])("rejects %s", (_label, payload) => {
      expect(rejection(payload)).toBe("Unknown message type");
    });
  });

  describe("commands without a payload", () => {
    test.each(["revealVotes", "hideVotes", "clearVotes", "lockVotes", "unlockVotes"])(
      "accepts %s",
      (type) => {
        expect(accepted({ type })).toEqual({ type } as never);
      },
    );

    test("ignores any data such a command carries", () => {
      expect(accepted({ type: "revealVotes", data: { nonsense: true } })).toEqual({
        type: "revealVotes",
      });
    });
  });

  describe("submitVote", () => {
    test("accepts a string vote", () => {
      expect(accepted({ type: "submitVote", data: { vote: "5" } })).toEqual({
        type: "submitVote",
        data: { vote: "5" },
      });
    });

    test("accepts an empty data object as a retraction", () => {
      // What the frontend actually sends to clear a vote: `vote` is
      // undefined, so JSON.stringify drops the key entirely.
      expect(accepted({ type: "submitVote", data: {} })).toEqual({
        type: "submitVote",
        data: {},
      });
    });

    test("rejects a missing data object", () => {
      expect(rejection({ type: "submitVote" })).toBe("submitVote requires a data object");
    });

    test.each([
      ["an object", { toString: 1 }],
      ["a number", 5],
      ["null", null],
    ])("rejects %s as a vote", (_label, vote) => {
      expect(rejection({ type: "submitVote", data: { vote } })).toBe(
        "submitVote requires a string vote",
      );
    });

    test("does not validate the vote against the deck — that needs room state", () => {
      // The door lets an off-deck card through; RoomManager rejects it.
      expect(accepted({ type: "submitVote", data: { vote: "not-a-card" } })).toEqual({
        type: "submitVote",
        data: { vote: "not-a-card" },
      });
    });
  });

  describe("sendReaction", () => {
    test("accepts a known reaction", () => {
      expect(accepted({ type: "sendReaction", data: { emoji: "👍" } })).toEqual({
        type: "sendReaction",
        data: { emoji: "👍" },
      });
    });

    test.each([
      ["an emoji outside the allowlist", "🔥"],
      ["a non-emoji string", "hello"],
      ["a number", 1],
      ["nothing", undefined],
    ])("rejects %s", (_label, emoji) => {
      expect(rejection({ type: "sendReaction", data: { emoji } })).toBe(
        "sendReaction requires a known reaction",
      );
    });

    test("rejects a missing data object", () => {
      expect(rejection({ type: "sendReaction" })).toBe("sendReaction requires a known reaction");
    });
  });

  describe("changeDeck", () => {
    test("accepts a known deck id", () => {
      expect(accepted({ type: "changeDeck", data: { deck: "tshirt" } })).toEqual({
        type: "changeDeck",
        data: { deck: "tshirt" },
      });
    });

    test.each([
      ["an unknown deck", "tarot"],
      ["a number", 3],
      ["nothing", undefined],
    ])("rejects %s", (_label, deck) => {
      expect(rejection({ type: "changeDeck", data: { deck } })).toBe(
        "changeDeck requires a known deck",
      );
    });
  });

  describe("transferAdmin", () => {
    test("accepts a username", () => {
      expect(accepted({ type: "transferAdmin", data: { newAdmin: "alice" } })).toEqual({
        type: "transferAdmin",
        data: { newAdmin: "alice" },
      });
    });

    test.each([
      ["an empty string", ""],
      ["an object", { a: 1 }],
      ["nothing", undefined],
    ])("rejects %s as newAdmin", (_label, newAdmin) => {
      expect(rejection({ type: "transferAdmin", data: { newAdmin } })).toBe(
        "transferAdmin requires a newAdmin",
      );
    });
  });

  describe("removeParticipant", () => {
    test("accepts a username", () => {
      expect(accepted({ type: "removeParticipant", data: { participant: "bob" } })).toEqual({
        type: "removeParticipant",
        data: { participant: "bob" },
      });
    });

    test.each([
      ["an empty string", ""],
      ["an object", { a: 1 }],
      ["nothing", undefined],
    ])("rejects %s as participant", (_label, participant) => {
      expect(rejection({ type: "removeParticipant", data: { participant } })).toBe(
        "removeParticipant requires a participant",
      );
    });
  });

  describe("rebuilding", () => {
    test("drops unknown fields rather than rejecting the message", () => {
      // Additive tolerance: a newer client can send a field this backend
      // does not know about without being refused outright.
      expect(accepted({ type: "submitVote", data: { vote: "5", futureField: true } })).toEqual({
        type: "submitVote",
        data: { vote: "5" },
      });
    });

    test("does not carry a prototype-polluting key through", () => {
      const parsed = accepted('{"type":"transferAdmin","data":{"newAdmin":"alice","__proto__":{"x":1}}}');

      expect(parsed).toEqual({ type: "transferAdmin", data: { newAdmin: "alice" } });
      expect(Object.keys((parsed as { data: object }).data)).toEqual(["newAdmin"]);
    });
  });
});
