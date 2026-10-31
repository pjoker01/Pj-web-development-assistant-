# PJ Assistant — LiveKit Foundation Migration Plan

**Target repository:** `pjoker01/Pj-web-development-assistant-`  
**Working branch:** `livekit-starter-migration`  
**Upstream starter:** `livekit-examples/agent-starter-react`  
**Status:** Discovery and architecture mapping; no production files replaced.

## License

The upstream React starter is MIT licensed. Commercial use, modification, and redistribution are permitted. Retain the upstream copyright and MIT license notice in this repository and in substantial copies of upstream code.

## Verified architecture mismatch

- PJ's current application is Vite + React, with an Express `server.ts` and Vercel SPA rewrite.
- The LiveKit starter is Next.js 15.5 + React 19 and expects Next.js routing and server route handlers.
- This is a framework migration, not a drop-in component swap. Replacing only `src/` or `package.json` would break the current app.
- The starter's token route is development-oriented unless protected by real authentication. Do not ship an unauthenticated token endpoint.
- LiveKit provides the real-time voice transport and UI; it does not replace PJ's AI/business backend.

## Existing PJ capabilities to preserve

1. Official PJ business knowledge and consultation rules currently embedded in the legacy server and project knowledge.
2. The public PJ Assistant API client in `src/assistant/api/assistant-api.ts`, calling `https://chat.pjwebdev.online/api/pj-assistant/chat`.
3. Conversation history and session ID handling.
4. Consultation availability via `/booking-availability`.
5. Consultation request submission via `/booking-requests`.
6. PJ sunset visual identity and `public/pj-web-development-logo.webp`.
7. Existing assistant and admin routes only where their contracts are verified and supported.

## Migration design

### A. New Next.js presentation layer

Adopt the upstream starter's Next.js app structure and LiveKit Agents UI components on this isolated branch. Rebrand the UI as PJ Assistant, retain PJ's sunset logo and visual system, and tune the visualizer/orb to the PJ sunset experience.

### B. One PJ conversation adapter

Create a typed server/client adapter for the existing public PJ Assistant API. Both typed chat and voice transcript turns must use the same conversation/session contract. Do not add a second Gemini call in the browser or replace the existing platform AI brain.

### C. LiveKit voice backend

Connect the frontend to a PJ-owned LiveKit Agent. The agent must forward user turns to the same public PJ Assistant API, preserve session IDs and conversation history, and return assistant responses/transcriptions. Keep LiveKit credentials server-side. The token endpoint must enforce the application's visitor/session policy and rate limits before issuing room tokens.

### D. Booking and lead handoff

Keep availability and consultation submission connected to the existing PJ endpoints. Test that the UI collects a real available slot and sends the expected fields. Do not silently route booking forms to the legacy local JSON lead store.

### E. Legacy server decision

Do not copy the old `server.ts` wholesale into Next.js. First inventory every still-used endpoint. Move only verified, required server functions into Next.js route handlers or a separately deployed service with durable storage. Treat local JSON lead persistence as non-production.

## Required migration checks

- Preserve the official logo and PJ theme.
- Verify typed chat against the public PJ Assistant endpoint.
- Verify LiveKit token issuance is authenticated/rate-limited and secrets never reach the browser.
- Verify voice agent forwards to the same PJ AI brain.
- Verify transcript/session continuity across typed and spoken turns.
- Verify booking availability and booking request payloads end-to-end.
- Verify mobile browser microphone permission, reconnect, mute, stop, and text fallback.
- Run dependency install, typecheck, tests, and production build.
- Inspect deployment project/repository/domain mapping before any deployment.
- Keep production `main`, PJ Chat Platform, and PJ Hub untouched until the migration passes.

## Current blockers / constraints

The available GitHub connector can inspect and edit individual text files, but a working build/test environment has not yet been provisioned. Vercel sandbox creation attempts against the previously identified Vercel project returned HTTP 400, and that Vercel project has not been proven to be the standalone assistant deployment target. No source replacement, merge, or deployment has been performed.

## Upstream attribution

Source: https://github.com/livekit-examples/agent-starter-react  
License: MIT — retain the original LiveKit copyright and license notice.
