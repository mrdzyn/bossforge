# Security Policy

## Supported versions

BossForge Live has no supported public production release. The repository's
current `main` branch is a development line; no release-support or security
update guarantee is offered for individual branches, commits, or versions.

## Reporting a vulnerability

Please use GitHub's private reporting flow: open the repository's **Security**
tab and choose **Report a vulnerability** (Private Vulnerability Reporting) or
create a private draft through **Security Advisories**, if that option is
available. Include the affected commit or version, impact, and a concise
reproduction that does not expose other people's data.

Do not put vulnerability details or proof-of-concept exploit steps in a public
issue, pull request, discussion, or commit. If GitHub's private reporting
option is unavailable, do not publish the details; wait until the repository
maintainers provide or enable a private reporting route.

Please allow the maintainers to investigate and coordinate disclosure before
publishing details. There is no stated response or remediation SLA, support
guarantee, bug bounty, or commitment to issue a production release.

## Scope and safe testing

Reports may cover security weaknesses in BossForge's application code,
dependencies, local HTTP/WebSocket access controls, Twitch OAuth/EventSub
validation, chat-command handling, battle authority, or privacy boundaries.
Test only against your own local copy and accounts you control. Do not probe
other users, real Twitch channels, or external services without their explicit
authorization.

**Never publish Twitch client secrets, access or refresh tokens, cookies,
credentials, private chat data, viewer identifiers, authorization URLs, or
exploit details in public issues, pull requests, recordings, or screenshots.**
