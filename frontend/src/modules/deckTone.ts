export type CardTone = "green" | "amber" | "red" | "violet";

/**
 * Tokens that always sit off-scale (unknowns / abstentions) → violet.
 */
const specialTokens = ["?", "∞", "☕", "½"];

/**
 * The deck's ranked scale — its cards minus the special off-scale tokens.
 */
export function deckScale(cards: readonly string[]): string[] {
  return cards.filter((card) => !specialTokens.includes(card));
}

/**
 * Tone by RANK within a deck, so color encodes magnitude for any scale
 * (XS → green, M → amber, XL → red). Special tokens and values not in
 * the deck render violet.
 */
export function deckTone(value: string | undefined, cards: readonly string[]): CardTone {
  if (value == null || specialTokens.includes(value)) return "violet";

  const scale = deckScale(cards);
  const index = scale.indexOf(value);
  if (index < 0) return "violet";

  const rank = scale.length <= 1 ? 0 : index / (scale.length - 1);
  if (rank < 0.34) return "green";
  if (rank < 0.67) return "amber";
  return "red";
}
