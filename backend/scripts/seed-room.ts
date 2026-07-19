// Seed a room with fake voters and spectators for manual UI testing.
//
//   bun run seed <roomId> [--voters 12] [--spectators 6] [--vote 0.5] [--url ws://localhost:3000]
//
// Join the room in your browser first so you are its admin — if the room
// doesn't exist yet, the first seeded user becomes admin and the room closes
// when this script exits. Ctrl+C makes every seeded user leave immediately
// (no reconnect grace period).

import { normalizeRoomId } from "@shared/types";

const NAMES = [
  "Goku",
  "Vegeta",
  "Bulma",
  "Piccolo",
  "Gohan",
  "Krillin",
  "Trunks",
  "Goten",
  "ChiChi",
  "Yamcha",
  "Tien",
  "Chiaotzu",
  "Frieza",
  "Cell",
  "Buu",
  "Beerus",
  "Whis",
  "Roshi",
  "Bardock",
  "Raditz",
  "Nappa",
  "Videl",
  "Pan",
  "Dende",
  "Korin",
  "Yajirobe",
  "Launch",
  "Puar",
  "Oolong",
  "Broly",
];

const args = process.argv.slice(2);
const rawRoomId = args.find((a) => !a.startsWith("--"));
// Normalized so `seed Sprint42` seeds the same room a browser reaches at
// /room/Sprint42, rather than a second one keyed by the exact casing.
const roomId = rawRoomId ? normalizeRoomId(rawRoomId) : undefined;

function flag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

if (!roomId) {
  console.error(
    "Usage: bun run seed <roomId> [--voters 12] [--spectators 6] [--vote 0.5] [--url ws://localhost:3000]",
  );
  process.exit(1);
}

const voterCount = Number(flag("voters", "12"));
const spectatorCount = Number(flag("spectators", "6"));
const voteFraction = Math.min(1, Math.max(0, Number(flag("vote", "0.5"))));
const baseUrl = flag("url", "ws://localhost:3000");
const VOTE_VALUES = ["1", "2", "3", "5", "8", "13"];

// Unique names: shuffled pool first, numbered suffixes once it runs dry.
const pool = [...NAMES].sort(() => Math.random() - 0.5);
let overflow = 0;
const nextName = () => pool.pop() ?? `Saibaman${String(++overflow).padStart(2, "0")}`;

const sockets: WebSocket[] = [];

function connect(username: string, role?: "spectator"): Promise<WebSocket> {
  const url = new URL(baseUrl);
  url.searchParams.set("roomId", roomId!);
  url.searchParams.set("username", username);
  if (role) url.searchParams.set("role", role);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.type !== "joinRoomSuccess") return;
      if (msg.data.admin === username) {
        console.warn(`⚠ Room "${roomId}" didn't exist — ${username} is now its admin, so the room`);
        console.warn(
          "  closes when this script exits. Join from your browser first to avoid this.",
        );
      }
      sockets.push(ws);
      resolve(ws);
    };
    ws.onclose = (event) =>
      reject(new Error(`${username}: closed (${event.code}) ${event.reason}`));
    ws.onerror = () => reject(new Error(`${username}: connection failed — is the backend up?`));
  });
}

try {
  const voters: WebSocket[] = [];
  for (let i = 0; i < voterCount; i++) voters.push(await connect(nextName()));
  for (let i = 0; i < spectatorCount; i++) await connect(nextName(), "spectator");

  const votes = Math.round(voterCount * voteFraction);
  for (let i = 0; i < votes; i++) {
    const vote = VOTE_VALUES[Math.floor(Math.random() * VOTE_VALUES.length)];
    voters[i].send(JSON.stringify({ type: "submitVote", data: { vote } }));
  }

  console.log(
    `Seeded room "${roomId}" with ${voterCount} voters (${votes} voted) and ${spectatorCount} spectators.`,
  );
  console.log("Holding connections open — Ctrl+C to remove everyone.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  for (const ws of sockets) ws.close(1000, "User left room");
  process.exit(1);
}

process.on("SIGINT", () => {
  // The backend treats this exact reason as an intentional leave, so seeded
  // users vanish immediately instead of lingering through the grace period.
  for (const ws of sockets) ws.close(1000, "User left room");
  console.log(`\nRemoved ${sockets.length} seeded users from "${roomId}".`);
  setTimeout(() => process.exit(0), 200);
});

await new Promise(() => {});
