export type RoomMember = {
  name: string;
  point?: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
};

export function createRoomMembers(
  participants: Map<string, string | undefined>,
  adminUsername: string,
  currentUsername: string,
  votesVisible: boolean,
  cards: readonly string[],
): RoomMember[] {
  return Array.from(participants.entries())
    .map(([name, point]) => ({
      name,
      point,
      isAdmin: name === adminUsername,
      isCurrentUser: name === currentUsername,
    }))
    .sort((a, b) => compareRoomMembers(a, b, votesVisible, cards));
}

function compareRoomMembers(
  a: RoomMember,
  b: RoomMember,
  votesVisible: boolean,
  cards: readonly string[],
): number {
  if (votesVisible) {
    if (a.point == null && b.point != null) return 1;
    if (b.point == null && a.point != null) return -1;
    if (a.point != null && b.point != null) {
      if (a.point === "?" && b.point !== "?") return 1;
      if (b.point === "?" && a.point !== "?") return -1;
      // Sort revealed votes by rank within the deck so non-numeric
      // scales (T-shirt) order correctly; unknown values sink last.
      const rankA = pointRank(a.point, cards);
      const rankB = pointRank(b.point, cards);
      if (rankA !== rankB) return rankA - rankB;
    }
  }
  return a.name.localeCompare(b.name);
}

function pointRank(point: string, cards: readonly string[]): number {
  const rank = cards.indexOf(point);
  return rank === -1 ? Infinity : rank;
}
