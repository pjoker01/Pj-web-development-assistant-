import { PiperTTS, VoiceAgent } from '@todoforai/voiceloop';
import { sendAssistantMessage } from '../api/assistant-api';

export type PJVoiceAgentOptions = {
  getSessionId: () => string;
  setSessionId: (sessionId: string) => void;
  onEvent: (event: any) => void;
};

/** Speech profile and platform-backed LLM adapter for PJ Live Talk. */
export function createPJVoiceAgent({ getSessionId, setSessionId, onEvent }: PJVoiceAgentOptions) {
  return new VoiceAgent({
    sttProvider: 'webspeech',
    sttLang: 'en-ZA',
    tts: new PiperTTS('en_US-ryan-high'),
    speed: 1.02,
    bargeInMinChars: 2,
    keyterms: ['PJ Web Development', 'PJ Assistant', 'Pretoria', 'Sunnyside', 'WhatsApp', 'website', 'ecommerce'],
    persona: 'You are PJ Assistant, the official spoken assistant for PJ Web Development. Use a warm, confident, relaxed conversational English delivery. Prefer familiar South African wording where natural, but do not claim or imitate an accent the selected voice model does not provide. Avoid call-centre delivery, robotic phrasing, exaggerated enthusiasm or long monologues. Use contractions and natural pauses. You are an AI assistant; never claim to be human.',
    sysmsg: 'This is a live voice conversation on the public PJ Web Development website. Be conversational and helpful. Answer directly, remember the conversation, and ask one relevant follow-up when useful. Keep spoken answers concise unless the visitor asks for detail.',
    llm: async function* (history: any[], _system: string, signal: AbortSignal) {
      const lastIndex = history.length - 1;
      const last = history[lastIndex];
      const lastContent = typeof last?.content === 'string'
        ? last.content
        : Array.isArray(last?.content)
          ? last.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text || '').join(' ')
          : '';
      const incoming = String(lastContent || '').trim();
      if (!incoming) throw new Error('I did not catch that. Please try again.');
      if (incoming === '[PJ_GREETING]') {
        yield { text: 'Hey, welcome to PJ Web Development. I’m PJ Assistant. What are you looking to build, improve or figure out?' };
        return;
      }

      const isCheckin = incoming === '[PJ_SILENCE_CHECKIN]';
      const message = isCheckin
        ? 'Based on our conversation so far, gently check in with the visitor. Ask one short, relevant follow-up question. Do not repeat the opening greeting.'
        : incoming;
      const priorHistory = history.slice(0, lastIndex).slice(-20).map((item: any) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: typeof item.content === 'string'
          ? item.content
          : Array.isArray(item.content)
            ? item.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text || '').join(' ')
            : '',
      })).filter((item: any) => item.content);

      const body = await sendAssistantMessage({
        message,
        sessionId: getSessionId(),
        history: priorHistory,
        signal,
      });
      if (body.sessionId) setSessionId(body.sessionId);
      yield { text: body.reply.trim() };
    },
    onEvent,
  });
}
