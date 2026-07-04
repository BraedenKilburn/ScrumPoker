---
name: verify
description: Build/launch/drive recipe for verifying ScrumPoker changes end-to-end (backend WS/HTTP + frontend browser).
---

# Verifying ScrumPoker changes

## Launch

- Backend: `cd backend && bun src/index.ts` → `Listening on localhost:3000`.
- Frontend: `cd frontend && bun run dev` → Vite on `http://localhost:8080`
  (needs `frontend/.env.development` with `VITE_SOCKET_URL=ws://localhost:3000`).

## Drive the backend surface

- HTTP probe: `curl http://localhost:3000/rooms/:id` (also answers on the
  prod-style `/ws/rooms/:id` suffix path).
- WebSocket: connect `ws://localhost:3000/?roomId=X&username=Y[&deck=Z]`
  with a small Bun script (`new WebSocket(...)` works natively); messages
  are JSON `{ type, data }` per `shared/types.ts`. Two clients in one
  script covers broadcast behavior.

## Drive the frontend surface

- Playwright headless Chromium (install once:
  `bunx playwright install chromium-headless-shell`, then
  `bun add playwright` in a scratch dir and script against
  `http://localhost:8080`).
- Useful selectors: `.join-button` (home CTA), `.deck-option` /
  `.footer-cta .cta` (deck chooser), `.deck-chip` / `.change-deck`
  (room header), `.hand-strip .card-btn` (vote cards),
  `.p-dialog input` + `.p-dialog .p-button` (username dialog on
  refresh/deep link), `.p-toast-detail` (toasts).

## Gotchas

- A page refresh in a room resets Pinia → username dialog reappears
  (prefilled); complete it before asserting room state.
- Room state (deck chip etc.) first-paints with store defaults, then
  converges when `joinRoomSuccess` arrives — poll/wait for the expected
  text instead of reading immediately.
- Admin disconnect destroys the room instantly; probe `exists:false`
  mid-flow is expected until someone reconnects.
- `#app` uses `overflow-x: clip` (base.scss) — deliberately not
  `hidden`, which would make `#app` a scroll container and break
  `position: sticky` in every view.
