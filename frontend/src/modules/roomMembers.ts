export type RoomMember = {
  name: string;
  point?: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
};

export const pointValues = ["?", "1", "2", "3", "5", "8", "13", "21", "40"] as const;
export type PointValue = (typeof pointValues)[number];

export function createRoomMembers(
  participants: Map<string, string | undefined>,
  adminUsername: string,
  currentUsername: string,
  votesVisible: boolean,
): RoomMember[] {
  return Array.from(participants.entries())
    .map(([name, point]) => ({
      name,
      point,
      isAdmin: name === adminUsername,
      isCurrentUser: name === currentUsername,
    }))
    .sort((a, b) => compareRoomMembers(a, b, votesVisible));
}

function compareRoomMembers(a: RoomMember, b: RoomMember, votesVisible: boolean): number {
  if (votesVisible) {
    if (a.point == null && b.point != null) return 1;
    if (b.point == null && a.point != null) return -1;
    if (a.point != null && b.point != null) {
      if (a.point === "?" && b.point !== "?") return 1;
      if (b.point === "?" && a.point !== "?") return -1;
      const pointA = a.point === "?" ? Infinity : Number(a.point);
      const pointB = b.point === "?" ? Infinity : Number(b.point);
      if (pointA !== pointB) return pointA - pointB;
    }
  }
  return a.name.localeCompare(b.name);
}
