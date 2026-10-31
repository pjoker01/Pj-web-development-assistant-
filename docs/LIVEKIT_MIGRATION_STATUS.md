# PJ Assistant LiveKit migration status

## Implemented on branch pj-livekit-frontend

- Replaced the active Vite entrypoint with the upstream LiveKit Next.js starter architecture.
- Retained the upstream MIT LICENSE and its copyright notice.
- Preserved PJ sunset/orbit visual direction and the official public/pj-web-development-logo.webp.
- Reconnected text chat to the existing PJ Chat Platform assistant endpoint through the existing typed API adapter.
- Reconnected consultation availability and request submission to the existing PJ booking endpoints.
- Added a same-origin, short-lived, room-scoped LiveKit token endpoint. No LiveKit secret is exposed to the browser.
- Preserved original Vite/VoiceLoop sources, legacy server and architecture notes in the repository as inactive migration reference.

## Verification

- pnpm install completed.
- pnpm exec tsc --noEmit completed successfully.
- pnpm build completed successfully with Next.js 15.5.27.
- Local production server returned HTTP 200 for /.
- Token route correctly returned HTTP 503 when LiveKit credentials were not configured.

## Still required before live voice or production cutover

- Provision the LiveKit project credentials in the standalone assistant Vercel project.
- Deploy a LiveKit Agents worker with STT/TTS configured. Its LLM turn handler must call the existing PJ assistant API, preserving PJ's current business knowledge and session flow.
- Confirm the worker identity/dispatch and test real microphone, transcr¶»§q«^