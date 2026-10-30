import test from 'node:test';
import assert from 'node:assert/strict';
import { createPJVoiceSession } from './pj-voice-agent.ts';

const options = {
  getSessionId: () => 'session-1',
  setSessionId: (_sessionId: string) => {},
  onEvent: (_event: any) => {},
};

test('voice session starts once and destroys once', async () => {
  let starts = 0;
  let destroys = 0;
  let unlocks = 0;
  const fakeAgent = {
    start: async () => { starts += 1; },
    destroy: () => { destroys += 1; },
    notify: async (_message: string) => {},
    sendUserText: (_message: string) => true,
  };
  const session = createPJVoiceSession(options, (() => fakeAgent) as any, () => { unlocks += 1; });

  await session.start();
  await session.start();
  assert.equal(starts, 1);
  assert.equal(unlocks, 1);
  assert.equal(session.sendUserText('hello'), true);

  await session.notify('check in');
  session.destroy();
  session.destroy();
  assert.equal(destroys, 1);
  assert.equal(session.sendUserText('after close'), false);
  await assert.rejects(session.notify('after close'), /not active/);
});

test('failed voice startup tears down the partially-created agent', async () => {
  let destroys = 0;
  const fakeAgent = {
    start: async () => { throw new Error('permission denied'); },
    destroy: () => { destroys += 1; },
    notify: async (_message: string) => {},
    sendUserText: (_message: string) => true,
  };
  const session = createPJVoiceSession(options, (() => fakeAgent) as any, () => {});
  await assert.rejects(session.start(), /permission denied/);
  assert.equal(destroys, 1);
  assert.equal(session.sendUserText('after failure'), false);
});
