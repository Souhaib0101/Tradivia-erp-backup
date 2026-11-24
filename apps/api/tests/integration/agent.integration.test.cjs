const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const workspace = path.resolve(__dirname, '../../../..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tradivia-agent-'));

const responses = [];
const providerRequests = [];

function completion(message) {
  return {
    id: 'mock-completion',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-model',
    choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  };
}

function toolCall(id, name, args) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
  };
}

function text(content) {
  return { role: 'assistant', content };
}

let provider;
let providerUrl;

test.before(async () => {
  provider = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw); } catch {}
      providerRequests.push(body);
      const next = responses.shift();
      res.writeHead(next ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(next || { error: { message: 'No mock response queued' } }));
    });
  });
  await new Promise((resolve, reject) => {
    provider.once('error', reject);
    provider.listen(0, '127.0.0.1', resolve);
  });
  providerUrl = `http://127.0.0.1:${provider.address().port}`;

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(temporaryRoot, 'tradivia-agent.db');
  process.env.UPLOAD_DIR = path.join(temporaryRoot, 'uploads');
  process.env.DOCUMENT_WORKER_PATH = path.join(workspace, 'workers', 'documents');
  process.env.JWT_SECRET = 'agent-integration-secret-that-is-long-enough';
  process.env.ADMIN_DEFAULT_PASSWORD = 'IntegrationTest123!';
  process.env.SEED_DEMO_DATA = 'false';
  process.env.AGENT_ENABLED = 'true';
  process.env.AGENT_BASE_URL = providerUrl;
  process.env.AGENT_MODEL = 'mock-model';
  process.env.AGENT_API_KEY = 'test-key';
  process.env.AGENT_MAX_STEPS = '6';
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) db.close();
  if (provider) await new Promise(resolve => provider.close(resolve));
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

let server;
let baseUrl;
let token;
let db;
let conversationId;

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function request(route, options = {}) {
  const response = await fetch(baseUrl + route, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function jsonRequest(route, method = 'GET', body) {
  return request(route, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test('agent chat uses tools, blocks unconfirmed writes and executes confirmed writes', { timeout: 60_000 }, async () => {
  const loaded = require('../../server.cjs');
  db = loaded.db;
  server = loaded.app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  let result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'IntegrationTest123!' })
  });
  assert.equal(result.response.status, 200);
  token = result.body.token;

  result = await jsonRequest('/api/clients', 'POST', { name: 'Client Test', ice: '123456789012345' });
  assert.equal(result.response.status, 200);

  result = await jsonRequest('/api/agent/config');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.configured, true);
  assert.equal(result.body.model, 'mock-model');

  responses.push(
    completion(toolCall('call-list-1', 'list_clients', {})),
    completion(text('Il y a 1 client dans le systeme.'))
  );
  result = await jsonRequest('/api/agent/chat', 'POST', { message: 'Combien de clients avons-nous ?' });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.match(result.body.reply, /1 client/i);
  conversationId = result.body.conversation_id;
  assert.ok(conversationId);

  const toolResultMessage = providerRequests[1].messages.find(message => message.role === 'tool');
  assert.ok(toolResultMessage, 'the provider should receive the tool result');
  assert.match(toolResultMessage.content, /Client Test/);

  const clientsBefore = db.prepare("SELECT COUNT(*) AS count FROM clients WHERE name = 'Interdit'").get().count;
  responses.push(
    completion(toolCall('call-write-1', 'create_client', { confirm: true, name: 'Interdit', ice: '111111111111111' })),
    completion(text("Cette creation attend votre confirmation explicite."))
  );
  result = await jsonRequest('/api/agent/chat', 'POST', {
    conversation_id: conversationId,
    message: 'Cree un client Interdit'
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM clients WHERE name = 'Interdit'").get().count, clientsBefore);
  const confirmationRequest = providerRequests.at(-1);
  const blockedToolResult = confirmationRequest.messages.filter(message => message.role === 'tool').at(-1);
  assert.match(blockedToolResult.content, /CONFIRMATION_REQUIRED/);

  responses.push(
    completion(toolCall('call-write-2', 'create_client', { confirm: true, name: 'Autorise', ice: '222222222222222' })),
    completion(text('Le client Autorise a ete cree.'))
  );
  result = await jsonRequest('/api/agent/chat', 'POST', {
    conversation_id: conversationId,
    message: 'Oui, je confirme.'
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.match(result.body.reply, /Autorise/i);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM clients WHERE name = 'Autorise'").get().count, 1);

  const messages = db.prepare('SELECT role, content FROM agent_messages WHERE conversation_id = ? ORDER BY id').all(conversationId);
  assert.ok(messages.some(message => message.role === 'user' && /Oui, je confirme/.test(message.content)));
  assert.ok(messages.some(message => message.role === 'assistant' && /Autorise/.test(message.content)));

  const history = await jsonRequest(`/api/agent/conversations/${conversationId}/messages`);
  assert.equal(history.response.status, 200);
  assert.ok(history.body.messages.length >= 6);
});
