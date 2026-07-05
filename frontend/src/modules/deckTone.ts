import { isSpecialToken } from "@shared/types";

export type CardTone = "green" | "amber" | "red" | "violet";

/**
 * CSS color for a tone — the global `--tone-*` custom properties in
 * assets/base.scss, the single source shared with PointCard's bands.
 */
export function toneColor(tone: CardTone): string {
  return `var(--tone-${tone})`;
}

/**
 * The deck's ranked scale — its cards minus the special off-scale tokens.
 */
export function deckScale(cards: readonly string[]): string[] {
  return cards.filter((card) => !isSpecialToken(card));
}

/**
 * Tone by RANK within a deck, so color encodes magnitude for any scale
 * (XS → green, M → amber, XL → red). Special tokens and values not in
 * the deck render violet.
 */
export function deckTone(value: string | undefined, cards: readonly string[]): CardTone {
  if (value == null || isSpecialToken(value)) return "violet";

  const scale = deckScale(cards);
  const index = scale.indexOf(value);
  if (index < 0) return "violet";

  const rank = scale.length <= 1 ? 0 : index / (scale.length - 1);
  if (rank < 0.34) return "green";
  if (rank < 0.67) return "amber";
  return "red";
}
