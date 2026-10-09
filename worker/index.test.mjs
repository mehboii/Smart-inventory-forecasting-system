import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './index.js';

const prefix = '/Smartinventoryforecastingsystem';
const request = (path, options) => new Request(`https://example.test${prefix}${path}`, options);

test('base URL serves index.html without browser navigation headers', async () => {
  const response = await worker.fetch(request('/'), {
    ASSETS: { fetch: async (assetRequest) => {
      assert.equal(new URL(assetRequest.url).pathname, `${prefix}/index.html`);
      return new Response('<html>Inventory</html>');
    } }
  });
  assert.equal(response.status, 200);
});

test('login navigation accepts HTML and missing assets remain 404', async () => {
  const paths = [];
  const env = { ASSETS: { fetch: async (assetRequest) => {
    const path = new URL(assetRequest.url).pathname;
    paths.push(path);
    return new Response('', { status: path.endsWith('/index.html') ? 200 : 404 });
  } } };
  assert.equal((await worker.fetch(request('/login', { headers: { Accept: 'text/html' } }), env)).status, 200);
  assert.equal((await worker.fetch(request('/assets/missing.js'), env)).status, 404);
  assert.deepEqual(paths, [`${prefix}/index.html`, `${prefix}/assets/missing.js`]);
});

test('missing database configuration returns JSON instead of an uncaught rejection', async () => {
  const response = await worker.fetch(request('/api/auth/login', { method: 'POST' }), {});
  assert.equal(response.status, 503);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  assert.match((await response.json()).message, /not configured/);
});

test('upstream DNS failure is handled and invalid credentials still return 401', async (t) => {
  const env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_KEY: 'test-key' };
  const login = () => request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.test', password: 'test-password' })
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('error code: 1016', { status: 530 }));
  let response = await worker.fetch(login(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, 'Database service is unavailable. Contact your administrator.');
  globalThis.fetch.mock.mockImplementation(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
  response = await worker.fetch(login(), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Invalid email or password');
});

test('asynchronous asset failures return JSON', async () => {
  const response = await worker.fetch(request('/'), { ASSETS: { fetch: async () => { throw new Error('Asset failure'); } } });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { message: 'Unexpected server error' });
});
