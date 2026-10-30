# PJ Assistant — Repository Audit & Architecture Redesign

**Audit date:** 2026-10-30  
**Repository:** `pjoker01/Pj-web-development-assistant-`  
**Audited branch baseline:** `main` at `87ab80b01ac4081aa98bfa4de21b2b6aedceef18`  
**Production deployment observed:** `dpl_E4o7mjcELZdS7EtwqT17Gbf8FMjR`, READY, alias `assistant.pjwebdev.online`, built from `967b0acc59f7b306a2d5b67a09ad2799ff9adb6a`.

## Executive finding

The assistant is not suffering from one isolated microphone defect. The repository contains multiple overlapping generations of the product: a legacy Express/Gemini application, a legacy chat UI, a Vercel serverless bridge, and the newer React/VoiceLoop assistant. They do not share one API contract or one lifecycle. This is the main source of recurring regressions.

The live deployment also trails the latest source: the deployed commit is `967b0acc`; the current source includes later microphone-permission and lifecycle changes through `87ab80b0`. A READY deployment does not prove that the latest source is live or that a physical Android microphone works.

## Confirmed findings

### 1. Voice capture and lifecycle

- `src/PJAssistant.tsx` owns UI, chat requests, VoiceLoop construction, microphone setup, TTS configuration, transcripts, silence follow-ups, booking UI, and dictation in one large component.
- State is represented by several overlapping values: `mode`, `isLiveMode`, `voiceActive`, `isDictating`, `isSending`, and `error`. These can become inconsistent after a partial start, a recognition error, a disconnect, or a user closing the screen.
- The Live Talk path uses VoiceLoop with `sttProvider: 'webspeech'`. VoiceLoop's upstream documentation says Web Speech is browser-managed, bypasses its normal VAD/mic-level pipeline, and does not emit `level` events. The current UI nevertheless expects `event.level` to drive the orb meter. Therefore the microphone ring cannot show actual microphone amplitude in this configuration.
- VoiceLoop documentation recommends cloud STT rather than Web Speech for iOS continuous voice sessions. Browser support and behavior vary; a browser constructor check alone is not a complete microphone health check.
- The separate dictation recognizer (`toggleDictation`) is another microphone owner. Live Talk does not first guarantee that dictation has stopped. Two recognizers can contend for the same device.
- The latest source added a temporary `getUserMedia()` permission request, immediately stops that stream, and then starts VoiceLoop, which opens its own capture path. That is two capture operations in one startup sequence and should be replaced by a single documented mic owner. The production deployment inspected predates this latest preflight.
- Error events are not consistently promoted into a terminal voice-session state. The component can retain a Live UI while the agent has failed or disconnected.
- The selected local Piper voice is cost-free, but Piper is a local neural TTS engine, not a human-grade studio voice. Persona text cannot change the acoustic characteristics or accent of a voice model.

### 2. API and conversation contracts

- The current assistant correctly intends to use the existing PJ Chat Platform public assistant route: `https://chat.pjwebdev.online/api/pj-assistant/chat`. The platform repo contains that public route in `server/pjAssistantBookingRoutes.ts`; it is distinct from the admin-only `/api/pj-assistant/chat` route in the platform's main server.
- The standalone repository also contains `api/chat.ts`, a separate Vercel function that proxies to `/api/chat/:clientId`. The current `PJAssistant.tsx` does not use it. This leaves two competing chat bridges with different request contracts.
- The old `server.ts` also defines a third `/api/chat` implementation using a Gemini key and a different history format. It is not the current public assistant brain.
- Current text and VoiceLoop requests both call the platform's public assistant route, which is the correct direction, but that contract is embedded directly inside the React component instead of a single typed API client.
- The public platform route accepts history items as `{ role, content }`, normalizes them, persists the conversation, and returns a `sessionId`. This needs a shared typed contract and tests so text and voice cannot drift.

### 3. Project enquiry / booking

- The current component fetches availability from `/api/pj-assistant/booking-availability` on the platform, but the project form submits to the standalone origin's `/api/leads` with a different payload.
- The platform already exposes `POST /api/pj-assistant/booking-requests`, which requires `customerName`, `customerContact`, and a valid `requestedStart`. The current form does not collect or submit a requested appointment time and does not call this endpoint.
- The standalone repository's old `server.ts` implements `POST /api/leads` and a local/Notion lead flow, but the current Vercel frontend deployment is a Vite project with a SPA rewrite. There is no `api/leads.ts` Vercel function in this repository. The old Express route is not automatically available just because it exists in `server.ts`.
- The form currently fetches availability data into `slots` but does not render or use those slots to select a time. The `selectedSlot` state is not connected to the form submission.

### 4. Hosting and legacy application mismatch

- Vercel reports this project as framework `vite`; `vercel.json` contains only a catch-all rewrite to `index.html`.
- The standalone repo has a large Express server with Gemini chat, Notion lead capture, admin login, local JSON lead storage, and static serving. The production Vercel build is not configured to run that Express server as a persistent application.
- `src/main.tsx` routes `/` and `/assistant` to the new assistant, `/pj-control` to the old admin UI, and other paths to the legacy `App`.
- `src/App.tsx` uses the old `/api/chat` and `/api/leads` contracts. `src/Admin.tsx` calls `/api/admin/*`. Those contracts are implemented in `server.ts`, not as matching Vercel function files. This makes the legacy paths inconsistent with the current hosting model.
- `server.ts` stores leads in a local JSON file. That is not durable storage for a serverless deployment.
- There is no lockfile in the repository and no automated test script in `package.json`. The `lint` script is only `tsc --noEmit`; build and type-check results need to be treated separately.

## Root-cause conclusion for the reported microphone failure

The latest source and the live deployment are not the same revision. The live alias is on `967b0acc`, while the permission-preflight change is later in `87ab80b0`. More importantly, the current design relies on browser Web Speech for mobile STT, even though its microphone behavior and event model differ from the normal VoiceLoop pipeline. The orb is wired to a level event that Web Speech does not emit. The UI also has no single authoritative state machine for start, permission, listening, error, disconnect, and stop.

This is an architecture issue, not a problem that should be solved by adding another isolated microphone patch.

## Target redesign

### A. One conversation core

Create a small, explicit assistant core with these responsibilities:

1. **Conversation controller** — owns one conversation ID, transcript, pending request, and one lifecycle state.
2. **Assistant API client** — the only place that calls the existing platform public assistant endpoint. It validates response shape, handles timeouts/errors, and is used by both typed and spoken messages.
3. **Voice session adapter** — owns exactly one VoiceLoop instance and one microphone lifecycle. It exposes start, stop, send-text, mute, and event subscriptions; the React UI never constructs VoiceLoop directly.
4. **Speech profile** — isolates STT language/provider, TTS engine/voice ID, speed, and persona. The UI must not pretend that a local voice has a South African accent unless the model actually has one.
5. **Presentation layer** — orb, transcript, composer, permission prompt, status and error views. It renders state; it does not own audio capture or API transport.

### B. One finite-state machine

Use one authoritative state, with explicit transitions:

`idle → requesting-permission → listening → thinking → speaking → listening`

Terminal and recovery states:

`unsupported`, `permission-denied`, `network-error`, `voice-error`, `stopping`.

No separate booleans should independently decide whether the orb is open, the mic is active, or the agent exists. A disconnect or error must stop/release the session and return to a safe state.

### C. One microphone owner

- Remove the second temporary mic stream and the independent dictation recognizer from the Live Talk path.
- Start VoiceLoop directly from the user's Live Talk gesture so its documented `agent.start()` owns the capture request.
- Show a clear permission explainer and a retry action if the browser denies access.
- Detect unsupported STT before starting and provide a clear text-only fallback.
- Do not promise a true amplitude meter for Web Speech. Either use state/interim-transcript animation, or select a supported STT provider that exposes VoiceLoop's VAD/level pipeline after credentials and costs are approved.

### D. One backend contract

- Keep the public PJ Assistant brain in the existing Chat Platform; do not move the assistant to a separate Gemini prompt or add ElevenLabs as a requirement.
- Use the public `/api/pj-assistant/chat` route for both typed and spoken turns.
- Preserve session IDs and normalized `{ role, content }` history.
- Connect the project enquiry UI to a real supported platform endpoint. For an appointment request, collect an actual requested date/time and call `/api/pj-assistant/booking-requests`; otherwise call a deliberately designed lead-capture endpoint. Do not mix the two concepts.
- Remove or quarantine unused competing `/api/chat`, Gemini and local-file lead paths only after confirming whether the legacy `App` and admin pages are still required.

### E. Test and release gates

Before any production alias is moved:

1. Type-chat contract test against the platform public route.
2. VoiceLoop adapter tests with mocked permission grant, denial, unsupported browser, disconnect, interruption, and repeated start/stop.
3. Conversation history test proving typed and voice turns share the same session.
4. Booking/lead test proving the UI calls the matching endpoint and payload.
5. Production smoke test of the deployed JS commit and API routes.
6. Physical Android Chrome test: first permission prompt, allow, speak, hear response, interrupt, stop, retry after denial.
7. Confirm the production alias points to the exact tested commit.

## Scope / safety

- This branch is a design and refactor workspace. Do not change the production alias from this branch until the above gates pass.
- Keep the existing PJ Chat Platform project, Supabase data, client ID, public knowledge and business configuration intact.
- Do not touch PJ Hub or other PJ repositories.
- Do not expose provider secrets in the browser.
