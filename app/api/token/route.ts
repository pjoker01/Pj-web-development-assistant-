import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const requestHost = forwardedHost || request.headers.get('host');
  if (!origin || !requestHost) {
    return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403 });
  }
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== requestHost) {
      return NextResponse.json(
        { error: 'Cross-origin token requests are not allowed.' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'Live voice is not configured yet.' }, { status: 503 });
  }

  const identity = `pj-visitor-${crypto.randomUUID()}`;
  const roomName = `pj-assistant-${crypto.randomUUID()}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: 'PJ Assistant visitor',
    ttl: '10m',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json(
    {
      serverUrl,
      roomName,
      participantName: 'PJ Assistant visitor',
      participantToken: await token.toJwt(),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
