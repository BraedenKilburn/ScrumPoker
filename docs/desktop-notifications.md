# Desktop notifications

## Agreed behavior

- Target desktop and laptop users with the room open and connected.
- Sound and desktop notifications are independent preferences.
- Notify when the room tab is hidden or its window lacks focus.
- Notify for votes cleared, deck changed, and hidden votes becoming revealed,
  including re-reveals.
- Do not notify on join or reconnect or replay missed events.
- Include spectators; suppress notifications for the member's own actions.
- Show the room name and “New round started” or “Votes revealed”, without
  ticket details or results. Clicking brings the existing room tab forward.
- Keep only the latest notification per room. Dismiss it when the member
  returns to the room or leaves it.
- Default notifications off; remember the preference across visits on the
  same browser. Request permission only when explicitly enabled. Explain
  blocked permission or missing browser support in Settings.
- Coordinate tabs: at most one notification per room, and none while any
  copy of that room is actively viewed (visible and focused).
- When issuing a native notification with Sound enabled, allow the native
  notification sound and suppress the original app cue for that event.
  With Sound disabled, request a silent notification.
- Native sound follows browser and OS settings; the app cannot guarantee
  an audible notification or override system muting.
- When the room is foregrounded and no native notification is sent, keep
  the original app sound cues when Sound is enabled.

## Prerequisite

[Settings modal — issue #34](https://github.com/BraedenKilburn/ScrumPoker/issues/34)
moves Sound and admin-only Change deck into Settings while leaving Invite
and Leave directly accessible. The modal must support narrow windows and
keyboard focus correctly. Notification controls will be added there later.

## Review status

The user confirmed the complete design, including retaining original app
sound cues in the foreground. Implemented for issue
[#36](https://github.com/BraedenKilburn/ScrumPoker/issues/36).

## Implementation observations

The session retains its single server-message switch and owns the notification
composable. Live action metadata identifies the authenticated actor and orders
events within a server stream; snapshots have no alert identity.

A Web Lock elects one notification owner per room. BroadcastChannel forwards
live events to that owner, which holds the notification handle and explicitly
closes it before replacement. Shared activity locks advertise visible, focused
room tabs and are released by the browser if a tab terminates. The latest
handled sequence is persisted for ownership transfer without replay. The owner
also chooses foreground audio after deduplication, so delayed copies cannot
play an app cue after native sound. An owner who initiated an event yields
delivery to an eligible tab. Queued
alerts older than five seconds are discarded when delivery resumes.

The Notifications API's `silent: true` requests silence; leaving `silent`
unset respects device defaults when Sound is enabled. Current desktop
Chrome, Edge, Firefox, and Safari support this option, per
[MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json).
See [silent option semantics](https://developer.mozilla.org/en-US/docs/Web/API/Notification/silent).
Verify actual native sound behavior on target browsers and operating systems.

## Validation

Automated checks cover backend identity, session event routing, notification
preferences, cross-tab suppression/ownership transfer, lifecycle, and audio.
Workspace lint/type-check and a production build using the sample local socket
URL pass. The explicit frontend
application type-check also passes with `--ignoreDeprecations 6.0` (the existing
project uses the deprecated `baseUrl` option). Run the full suite with
`PORT=0 bun run test` so Bun receives the ephemeral-port setting at startup;
setting it only inside the integration test did not avoid a port-3000 conflict.

No connected browser was available to the Browser runtime during implementation.
Native banners, click-to-focus restrictions, OS sound, and visual layout in
Chrome/Edge, Firefox, and Safari therefore still require manual verification.
