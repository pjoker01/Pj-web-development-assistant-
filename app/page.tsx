import { PjExperience } from '@/components/pj-experience';

const voiceReady = Boolean(
  process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.LIVEKIT_AGENT_NAME
);
export default function Page() {
  return <PjExperience voiceReady={voiceReady} agentName={process.env.LIVEKIT_AGENT_NAME} />;
}
