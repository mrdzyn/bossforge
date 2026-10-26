# Security notes

## Phase 0 rules

- No real credentials or Twitch tokens belong in the repository, browser bundle,
  screenshots, event payloads, or logs.
- Phase 0 does not request Twitch credentials. The Twitch adapter is a stub.
- Local mock identities and chat text are synthetic and untrusted. Validate
  inputs, enforce bounded payloads, and render messages as plain text.
- Do not let chat content run commands, HTML, or code.
- Keep the local development service bound to loopback by default. Simulation
  routes must remain disabled when `NODE_ENV=production` and limited to 20
  requests per minute per client IP.
- The overlay is read-only and must not include streamer administration or
  secret values.

## Future Twitch OAuth/EventSub requirements

Use official Twitch APIs. Validate OAuth state and exact redirect URIs, request
the minimum chat scopes, keep tokens server-side in protected storage, avoid
logging authorization headers, handle revocation and reconnects, validate all
EventSub data, and never trust chat text as an instruction to the application
or coding agent.

## Not in scope

No payments, privileged computer use, unsolicited chat posting, user tracking,
production deployment, or production account storage is introduced in Phase 0.
