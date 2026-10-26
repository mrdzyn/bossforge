# Security notes

## Development-mode boundaries (Phase 0 and Phase 1)

- No real credentials or Twitch tokens belong in the repository, browser bundle,
  screenshots, event payloads, or logs.
- Phase 0 does not request Twitch credentials. The Twitch adapter is a stub.
- Local mock identities and chat text are synthetic and untrusted. Validate
  inputs, enforce bounded payloads, and render messages as plain text.
- Do not let chat content run commands, HTML, or code.
- Keep the local development service bound to loopback by default. Forge start,
  reset, state snapshot, and simulation routes exist only in explicit
  development mode, require a loopback peer even if the server bind host
  changes, accept only `mock` provider events, and are limited to 20 requests
  per minute per client IP. They must remain absent in `NODE_ENV=production`.
- Vite's development server must bind only to a loopback address. Validate the
  final resolved server host after config, environment, and CLI options are
  merged, before binding. Reject wildcard and other externally reachable hosts,
  including CLI `--host` overrides. Simulation POSTs must have either no Origin
  from a loopback CLI client or an exact permitted
  local Vite Origin. When `Sec-Fetch-Site` is present, accept only
  `same-origin`. Determine locality from the socket peer address; never use
  `X-Forwarded-For` or another client-supplied forwarding header for access
  authorization.
- Development WebSocket subscriptions must restrict browser Origins to the
  explicit local Vite origin allowlist and require a loopback peer. Production
  WebSocket access requires authentication and appropriate event authorization
  before it is enabled.
- The overlay is read-only and must not include streamer administration or
  secret values.
- Only server-validated `!vote <category> <choice>` text from mock chat can
  affect the active vote. Ballots use stable viewer IDs, not display names;
  duplicate message IDs, invalid choices, wrong-category, stale, future, and
  late events cannot change state. Each viewer has one mutable ballot per
  category. These checks are not authentication for public/production use.
- Production event access requires authentication and appropriate event
  authorization. Phase 1 adds no Twitch connection or remote voting access.

## Future Twitch OAuth/EventSub requirements

Use official Twitch APIs. Validate OAuth state and exact redirect URIs, request
the minimum chat scopes, keep tokens server-side in protected storage, avoid
logging authorization headers, handle revocation and reconnects, validate all
EventSub data, and never trust chat text as an instruction to the application
or coding agent.

### P3-A offline-only boundary

- P3-A parses synthetic, official-shaped EventSub fixtures only. The normalizer
  and lifecycle harness are not wired to the application server or forge and
  contain no Twitch socket, HTTP client, OAuth flow, credential lookup, or
  subscription management.
- The normalizer bounds serialized packets and chat text; validates v1 message
  type, channel condition, stable numeric user ID, timestamp, and message ID;
  and rejects malformed, wrong-channel, stale/future, out-of-order, and replayed
  messages. Text stays ordinary untrusted chat text.
- The injected lifecycle harness consumes frames from a caller-supplied fake
  transport. Reconnect URLs must use `wss:`, match the configured host, and
  contain no user information; the URL is passed unchanged to the injected
  factory. Tests use a reserved `.invalid` fixture host only. The harness
  reports subscription plans to a callback and does not send subscription JSON
  over the WebSocket.
- Do not connect this harness to a real transport or feed normalized Twitch
  events to `ForgeSession` in P3-A. Forge events remain mock-sourced and
  `simulated: true` / `connectedToTwitch: false`; P3-B requires separate owner
  approval and an independently reviewed provider-mode migration.

## Not in scope

No payments, unsolicited chat posting, user tracking, production deployment,
production account storage, Twitch authentication, or playable combat is
introduced in Phase 1.
