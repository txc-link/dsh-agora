/**
 * tts-adapter unit tests.
 *
 * Uses node:test + node:assert/strict (no third-party deps).
 * The adapter wraps fetch() — we stub globalThis.fetch.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FishSpeechTtsAdapter, FishSpeechTtsError } from '../lib/voice/tts-adapter.js';

function makeFakeFetch(responder) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  };
  return calls;
}

function restoreFetch() {
  delete globalThis.fetch;
}

test('synthesize: posts JSON to /v1/tts and returns WAV bytes', async () => {
  const wav = Buffer.from('RIFFtest', 'binary');
  const calls = makeFakeFetch(async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:8080/v1/tts');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'application/json');
    const body = JSON.parse(init.body);
    assert.equal(body.text, 'hello world');
    assert.equal(body.format, 'wav');
    assert.equal(body.sample_rate, 22050);
    return new Response(wav, { status: 200 });
  });
  try {
    const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080' });
    const result = await adapter.synthesize('hello world');
    assert.equal(calls.length, 1);
    assert.equal(result.mediaType, 'audio/wav');
    assert.match(result.filename, /^tts-\d+\.wav$/);
    assert.deepEqual(Buffer.from(result.bytes), wav);
  } finally {
    restoreFetch();
  }
});

test('synthesize: honors voice and format overrides', async () => {
  const calls = makeFakeFetch(async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.voice, 'alloy');
    assert.equal(body.format, 'mp3');
    assert.equal(body.sample_rate, 16000);
    return new Response(Buffer.from([0xff, 0xfb]), { status: 200 });
  });
  try {
    const adapter = new FishSpeechTtsAdapter({
      baseUrl: 'http://127.0.0.1:8080',
      voice: 'alloy',
      format: 'mp3',
      sampleRate: 16000,
    });
    const result = await adapter.synthesize('hi');
    assert.equal(result.mediaType, 'audio/mpeg');
    assert.match(result.filename, /\.mp3$/);
  } finally {
    restoreFetch();
  }
});

test('synthesize: trims trailing slash from baseUrl', async () => {
  const calls = makeFakeFetch(async (url) => {
    assert.equal(url, 'http://127.0.0.1:8080/v1/tts');
    return new Response(Buffer.from('x'), { status: 200 });
  });
  try {
    const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080/' });
    await adapter.synthesize('hi');
  } finally {
    restoreFetch();
  }
});

test('synthesize: throws on empty text', async () => {
  const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080' });
  await assert.rejects(adapter.synthesize('   '), (e) => e instanceof FishSpeechTtsError && /empty/.test(e.message));
});

test('synthesize: throws on text exceeding maxTextLength', async () => {
  const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080', maxTextLength: 5 });
  await assert.rejects(adapter.synthesize('too long text'), (e) => e instanceof FishSpeechTtsError && /exceeds/.test(e.message));
});

test('synthesize: throws on non-2xx response', async () => {
  makeFakeFetch(async () => new Response('service down', { status: 503 }));
  try {
    const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080' });
    await assert.rejects(adapter.synthesize('hi'), (e) => e instanceof FishSpeechTtsError && e.httpStatus === 503);
  } finally {
    restoreFetch();
  }
});

test('synthesize: throws on empty body', async () => {
  makeFakeFetch(async () => new Response(new Uint8Array(0), { status: 200 }));
  try {
    const adapter = new FishSpeechTtsAdapter({ baseUrl: 'http://127.0.0.1:8080' });
    await assert.rejects(adapter.synthesize('hi'), (e) => e instanceof FishSpeechTtsError && /empty/.test(e.message));
  } finally {
    restoreFetch();
  }
});

test('constructor: throws when baseUrl missing', () => {
  assert.throws(() => new FishSpeechTtsAdapter({ baseUrl: '' }), FishSpeechTtsError);
});
