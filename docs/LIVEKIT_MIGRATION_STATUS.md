# PJ Assistant LiveKit migration status

## Implemented on `livekit-starter-migration`

- Copied the LiveKit React starter into the PJ repository and retained its MIT licence and copyright notice.
- Replaced the active Vite entrypoint with the Next.js starter architecture while preserving the original Vite/VoiceLoop sources as inactive migration references.
- Preserved the PJ sunset/orbit visual direction and official `public/pj-web-development-logo.webp`.
- Reconnected text chat to the existing PJ Chat Platform assistant endpoint through a typed API adapter.
- Reconnected consultation availability and request submission to the existing PJ booking endpoints.
- Added a same-origin, short-lived, room-scoped LiveKit token endpoint. The LiveKit API secret is never exposed to the browser.
- Added a PJ-owned Python LiveKit Agents worker in `voice-agent/`. It forwards voice turns to the same PJ Chat Platform API and does not call a second LLM.
- Configured replaceable OpenAI-compatible STT and TTS endpoints, with local Whisper-compatible STT and Kokoro TTS as the self-hosting target.

## Verification completed

- Frontend dependency installation completed in the recovered Vercel workspace.
- TypeScript check completed successfully.
- Next.js production build completed successfully.
- Local production server returned HTTP 200 for the home page.
- Token endpoint returned HTTP 503 when LiveKit credentials were intentionally absent, as expected.
- The Python worker source has been added to the GitHub migration branch; full runtime verification still requires its Python dependencies and speech services.

## Remaining before a live voice test

- Provision matching LiveKit server credentials for the web app and worker, or deploy a self-hosted LiveKit media server.
- Deploy and start the PJ voice worker with the same `LIVEKIT_AGENT_NAME` configured in the web app.
- Provision the Whisper-compatible STT and Kokoro-compatible TTS services, or configure alternate compatible endpoints.
- Test a real microphone conversation, transcript accuracy for South African English, response playback, interruptions, session continuity, and mobile browsers.
- Review token endpoint abuse protection and booking flow end-to-end before production cutover.

## Release safety

No production deployment or merge to `main` has been performed. The existing live assistant remains untouched.
