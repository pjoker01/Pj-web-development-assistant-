"""PJ voice worker: LiveKit handles media; PJ Chat Platform remains the only AI brain."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, stt
from livekit.plugins import openai, silero

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("pj-voice-agent")

PJ_CHAT_ENDPOINT = os.getenv(
    "PJ_ASSISTANT_CHAT_URL",
    "https://chat.pjwebdev.online/api/pj-assistant/chat",
)
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "pj-assistant")


def _text_messages(chat_ctx: Any) -> list[dict[str, str]]:
    """Return only plain user/assistant turns understood by PJ's existing chat API."""
    messages: list[dict[str, str]] = []
    for item in getattr(chat_ctx, "items", []):
        if getattr(item, "type", None) != "message":
            continue
        role = getattr(item, "role", None)
        content = getattr(item, "text_content", None)
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content.strip()})
    return messages


class PJAssistant(Agent):
    """Thin voice adapter that forwards every turn to PJ's existing assistant API."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are PJ Web Development's voice interface. "
                "The PJ Chat Platform API is the source of truth for all answers."
            )
        )
        self.session_id = ""

    async def llm_node(self, chat_ctx, tools, model_settings) -> str:
        del tools, model_settings
        messages = _text_messages(chat_ctx)
        user_index = next(
            (index for index in range(len(messages) - 1, -1, -1)
             if messages[index]["role"] == "user"),
            None,
        )
        if user_index is None:
            return "Sorry, I missed that. Could you say it again?"

        latest_message = messages[user_index]["content"]
        history = messages[:user_index][-20:]
        payload = {
            "message": latest_message,
            "sessionId": self.session_id,
            "history": history,
        }

        try:
            timeout = httpx.Timeout(45.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(PJ_CHAT_ENDPOINT, json=payload)
                response.raise_for_status()
                result = response.json()

            reply = result.get("reply")
            if not isinstance(reply, str) or not reply.strip():
                raise ValueError("PJ assistant API returned an empty reply")
            returned_session = result.get("sessionId")
            if isinstance(returned_session, str) and returned_session:
                self.session_id = returned_session
            return reply.strip()
        except (httpx.HTTPError, ValueError, TypeError):
            logger.exception("PJ assistant API request failed")
            return "I'm having trouble reaching PJ's assistant right now. Please try again in a moment."


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def pj_assistant_voice(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name, "agent": AGENT_NAME}

    # Whisper-compatible STT and Kokoro TTS run as separately self-hostable services.
    # Their endpoints and model choices are configurable; no LiveKit Inference is required.
    vad = silero.VAD.load()
    stt_model = openai.STT(
        model=os.getenv("PJ_STT_MODEL", "whisper-1"),
        base_url=os.getenv("PJ_STT_BASE_URL", "http://faster-whisper:8000/v1"),
        api_key=os.getenv("PJ_STT_API_KEY", "not-needed"),
    )
    speech_to_text = stt.StreamAdapter(stt_model, vad=vad)
    text_to_speech = openai.TTS(
        model=os.getenv("PJ_TTS_MODEL", "kokoro"),
        voice=os.getenv("PJ_TTS_VOICE", "am_michael"),
        base_url=os.getenv("PJ_TTS_BASE_URL", "http://kokoro:8880/v1"),
        api_key=os.getenv("PJ_TTS_API_KEY", "not-needed"),
        response_format="wav",
    )

    session = AgentSession(stt=speech_to_text, tts=text_to_speech, vad=vad)
    await session.start(agent=PJAssistant(), room=ctx.room)
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
