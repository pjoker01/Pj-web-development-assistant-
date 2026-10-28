const PLATFORM_ORIGIN = 'https://chat.pjwebdev.online';
const PJ_WEB_DEV_CLIENT_ID = 'client_ge8euv97';
const recentRequests = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const current = recentRequests.get(key);
  if (!current || current.resetAt <= now) {
    recentRequests.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 20;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const host = typeof req.headers.host === 'string' ? req.headers.host : '';
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== host) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }
  }

  const forwarded = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : 'unknown';
  if (rateLimited(forwarded)) return res.status(429).json({ error: 'Too many messages. Please wait a minute and try again.' });

  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 2000) : '';
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim().slice(0, 100) : '';
  if (!message) return res.status(400).json({ error: 'Enter a message to continue.' });
  if (message.length > 2000) return res.status(400).json({ error: 'That message is too long.' });
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) return res.status(400).json({ error: 'This chat session is invalid. Refresh and try again.' });

  try {
    const upstream = await fetch(`${PLATFORM_ORIGIN}/api/chat/${PJ_WEB_DEV_CLIENT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ message, sessionId, platform: 'web' }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload: any = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status >= 500 ? 503 : upstream.status).json({
        error: typeof payload.error === 'string' ? payload.error : 'The PJ AI service is temporarily unavailable.',
      });
    }
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
      return res.status(503).json({ error: 'The PJ AI service returned an empty response. Please try again.' });
    }
    return res.status(200).json({ reply: payload.reply, status: payload.status || 'ok' });
  } catch (error) {
    console.error('[PJ Assistant bridge] Platform request failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ error: 'PJ Assistant is temporarily unavailable. Please try again shortly.' });
  }
}
