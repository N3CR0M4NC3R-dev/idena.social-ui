# idena.social UI

React/Vite client for reading and submitting idena.social posts, messages,
media, and tips through an Idena node or indexer.

[![Build](https://github.com/ubiubi18/idena.social-ui/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/ubiubi18/idena.social-ui/actions/workflows/build.yml)

The public site at [idena.social](https://idena.social) is an external
deployment. This source fork has no published release and does not claim that
the public site is running this commit. Build and inspect the client locally
before entering node or identity credentials.

## What was updated

- Node `24.18.0`, npm `11.16.0`, React `19.2`, Vite `8.1`, TypeScript `6.0`,
  React Router `8.1`, and compatible tooling replace the older build stack.
- The native `secp256k1` dependency was removed in favor of the maintained lite
  SDK source pin and browser-compatible cryptography.
- The remote approved-ads package was removed, reducing external runtime and
  supply-chain behavior.
- Node API keys, encrypted identity material, and passwords are cleared from
  browser persistence and kept only in application memory for the active
  session.
- Async/RPC behavior and transaction utilities gained regression tests and the
  browser build has an explicit stream compatibility shim.
- CI runs pinned actions, dependency/signature audits, privacy checks, tests,
  lint, and a production build.

## Benefits

- Reduced native and remote package surface in the browser bundle.
- Sensitive credentials are no longer restored from `localStorage` or
  `sessionStorage` after a reload.
- Current build tooling and a locked SDK source revision make the generated
  client easier to reproduce and audit.
- Automated privacy and secret checks reduce accidental publication of local
  paths, keys, or tokens.

## Risks and tradeoffs

- In-memory credentials improve confidentiality but reduce convenience: a page
  reload or browser restart requires credentials to be entered again.
- Any node API key entered into a browser is accessible to code running in that
  page. Use a dedicated, low-privilege, rate-limited key and a trusted node;
  never reuse a validator's unrestricted key.
- Posts, tips, and contract calls can be public, charge fees, and be
  irreversible. IPFS-hosted media may remain retrievable after the UI removes a
  reference.
- The SDK is pinned to a GitHub source archive rather than a release from this
  fork. Changing that pin requires a full transaction/signature regression run.
- The exact SDK commit and archive integrity are now constrained by
  [`compatibility/stack-lock.json`](compatibility/stack-lock.json); moving the
  dependency requires an intentional coordinated compatibility update.
- Major React, Router, Vite, and TypeScript upgrades can still cause browser or
  navigation regressions not covered by the current tests.
- The UI cannot prove that indexer responses, node RPC data, media URLs, or the
  deployed smart contract are trustworthy.

## Development

Requirements:

- Node.js `24.18.0` on the Node 24 LTS line
- npm `11.16.0`
- Git

```bash
npm ci
npm run audit:privacy
npm test
npm run lint
npm run build
```

Start the development server:

```bash
npm run dev
```

Preview the production bundle locally:

```bash
npm run preview
```

Use disposable credentials and a test identity for initial validation. Review
the configured node and indexer URLs before submitting any transaction.

## Upstream proposal

These changes are proposed in
[`N3CR0M4NC3R-dev/idena.social-ui#4`](https://github.com/N3CR0M4NC3R-dev/idena.social-ui/pull/4).
