import { PjExperience } from '@/components/pj-experience';

const agentName = process.env.LIVEKIT_AGENT_NAME || 'pj-assistant';
const voiceReady = Boolean(
  process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
);

export default function Page() {
  return <PjExperience voiceReady={voiceReady} agentName={agentName} />;
}
