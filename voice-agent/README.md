# PJ Assistant voice worker

This is PJ's own LiveKit Agents worker. LiveKit transports microphone audio between the browser and this worker; **the worker sends every recognized user turn to PJ's existing Chat Platform API**. It does not call a second LLM and does not contain a second copy of PJ's business rules.

## Run

1. Copy `.env.example` to `.env` and set the LiveKit connection credentials.
2. Start an OpenAI-compatible Whisper STT endpoint at `PJ_STT_BASE_URL`.
3. Start a Kokoro-FastAPI TTS endpoint at `PJ_TTS_BASE_URL`.
4. Install dependencies and start the worker:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python agent.py dev
```

For a production container, build this directory with its Dockerfile and run the image with the same environment variables.

## Independence and licensing

The worker source belongs to the PJ assistant repository. It uses the open-source LiveKit Agents Python SDK as a dependency (Apache-2.0); it does not require LiveKit Cloud or LiveKit Inference. The media server can be self-hosted separately. Speech recognition and synthesis are configured as replaceable OpenAI-compatible services; the documented defaults are local Whisper-compatible STT and local Kokoro TTS.

The React starter's MIT licence and copyright notice remain in the repository. The SDK and model services have their own licences and are not claimed as PJ-authored code.

## Production checks

- Use the exact same `LIVEKIT_AGENT_NAME` in the web app and worker.
- Keep `LIVEKIT_API_SECRET` only on trusted servers.
- Expose the LiveKit server over TLS and configure TURN for real-world networks.
- Restrict the PJ assistant API endpoint against abuse at its own API boundary.
- Verify STT/TTS health, South African English recognition, interruptions, session continuity, and mobile microphone permissions before enabling the live voice button.
