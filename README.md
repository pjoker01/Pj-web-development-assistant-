# PJ Web Development Assistant

PJ's standalone personal and business assistant. This repository is separate from PJ Chat Platform and PJ Hub.

## Current application

- Next.js App Router frontend based on the LiveKit agent-starter-react project.
- PJ-branded sunset/orbit visual identity and the original PJ Web Development logo.
- Text conversations use the existing PJ assistant brain at https://chat.pjwebdev.online/api/pj-assistant/chat.
- Consultation availability and request submission continue through the existing PJ assistant booking endpoints.
- The original Vite/VoiceLoop implementation and architecture audit are retained under src/ and docs/ as migration reference, not used as the active app entrypoint.

## Local development

    pnpm install
    pnpm dev

Copy .env.example to .env.local only when configuring LiveKit voice. Text chat does not require a new model key; it uses the existing PJ assistant API.

## Live voice requirement

The React starter is a frontend, not a hosted voice agent. LiveKit voice requires:
1. A LiveKit project and LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
2. A running LiveKit Agents worker configured as LIVEKIT_AGENT_NAME.
3. The worker must transcribe caller speech and forward the resulting text turns to the existing PJ assistant API. Do not add a second independent LLM brain.

Until all environment values and the compatible worker are configured, the app keeps voice visibly pending and text chat remains available. The token route ch¶»§q«^