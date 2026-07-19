import { isDeckId, isReactionEmoji, type ClientMessage } from "@shared/types";

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: string };

/**
 * The inbound seam. Everything arriving from a client passes through
 * here, and nothing downstream re-checks: `dispatch` may read
 * `msg.data.newAdmin` without guarding, because a message that reached it
 * has already been proven to have one.
 *
 * The door checks structure and values drawn from a closed set — a known
 * deck id, a known reaction, a non-empty name. It cannot check anything
 * that depends on room state (is this card in *this* room's deck? is this
 * member the admin?); those stay in the RoomManager, which is the only
 * thing that knows.
 *
 * Messages are rebuilt rather than passed through, so what flows on is
 * exactly the declared shape. Unknown fields are dropped, not rejected —
 * a newer client can add one without an older backend refusing it.
 */
export function parseClientMessage(raw: string): ParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return invalid("Invalid message format. Please send valid JSON.");
  }

  if (!isRecord(payload)) return invalid("Unknown message type");

  // Absent or non-object `data` reads as "no fields supplied"; each case
  // decides whether that is acceptable.
  const data = isRecord(payload.data) ? payload.data : undefined;

  switch (payload.type) {
    // Commands with no payload. Any `data` they carry is ignored.
    case "revealVotes":
    case "hideVotes":
    case "clearVotes":
    case "lockVotes":
    case "unlockVotes":
      return valid({ type: payload.type });

    case "submitVote": {
      if (!data) return invalid("submitVote requires a data object");

      const vote = data.vote;
      if (vote === undefined) return valid({ type: "submitVote", data: {} });
      if (typeof vote !== "string") return invalid("submitVote requires a string vote");

      return valid({ type: "submitVote", data: { vote } });
    }

    case "sendReaction": {
      const emoji = data?.emoji;
      if (!isReactionEmoji(emoji)) return invalid("sendReaction requires a known reaction");

      return valid({ type: "sendReaction", data: { emoji } });
    }

    case "changeDeck": {
      const deck = data?.deck;
      if (typeof deck !== "string" || !isDeckId(deck)) {
        return invalid("changeDeck requires a known deck");
      }

      return valid({ type: "changeDeck", data: { deck } });
    }

    case "transferAdmin": {
      const newAdmin = data?.newAdmin;
      if (!isNonEmptyString(newAdmin)) return invalid("transferAdmin requires a newAdmin");

      return valid({ type: "transferAdmin", data: { newAdmin } });
    }

    case "removeParticipant": {
      const participant = data?.participant;
      if (!isNonEmptyString(participant)) {
        return invalid("removeParticipant requires a participant");
      }

      return valid({ type: "removeParticipant", data: { participant } });
    }

    default:
      return invalid("Unknown message type");
  }
}

const valid = (message: ClientMessage): ParseResult => ({ ok: true, message });
const invalid = (reason: string): ParseResult => ({ ok: false, reason });

/** Arrays and null are not message shapes, however `typeof` sees them. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
