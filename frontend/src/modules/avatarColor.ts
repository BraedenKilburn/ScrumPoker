export type AvatarPalette = "emerald" | "amber" | "red" | "violet" | "blue" | "pink";

const palette: AvatarPalette[] = ["emerald", "amber", "red", "violet", "blue", "pink"];

function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getGraphemes(input: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(input)].map(
    ({ segment }) => segment,
  );
}

export function getAvatarColor(username: string): AvatarPalette {
  if (!username) return "emerald";
  return palette[hash(username) % palette.length];
}

export function getInitials(username: string): string {
  if (!username) return "??";
  const parts = username
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const wordInitials = parts.map((part) => part.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean);
  if (wordInitials.length >= 2) {
    return wordInitials.slice(0, 2).join("").toUpperCase();
  }
  const letters = username.match(/[\p{L}\p{N}]/gu);
  if (letters?.length) return letters.slice(0, 2).join("").toUpperCase();
  return getGraphemes(username.trim())[0] ?? "??";
}

export const paletteVar: Record<AvatarPalette, string> = {
  emerald: "var(--p-emerald-400)",
  amber: "var(--p-amber-400)",
  red: "var(--p-red-400)",
  violet: "var(--p-violet-400)",
  blue: "var(--p-blue-400)",
  pink: "var(--p-pink-400)",
};
