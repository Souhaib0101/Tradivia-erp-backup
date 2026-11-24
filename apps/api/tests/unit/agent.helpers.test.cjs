const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTools, selectTools, looksLikeConfirmation } = require('../../agent/agent.cjs');
const { htmlToText, extractTitle, isPrivateIPv4, isPrivateIPv6, decodeEntities } = require('../../agent/web.cjs');

test('agent exposes tools and requires explicit confirmation for writes', () => {
  const tools = buildTools();
  const names = tools.map(item => item.function.name);
  for (const name of ['create_invoice', 'create_client', 'create_container', 'create_charge', 'create_beneficiary_transfer', 'web_search', 'web_fetch', 'web_browse', 'track_container', 'export_invoice']) {
    assert.ok(names.includes(name), `${name} should be available`);
  }
  for (const name of ['create_invoice', 'create_client', 'create_container', 'create_charge', 'create_beneficiary_transfer']) {
    const schema = tools.find(item => item.function.name === name).function.parameters;
    assert.ok(schema.required.includes('confirm'), `${name} should require confirm`);
    assert.equal(schema.properties.confirm.type, 'boolean');
  }
  const beneficiary = tools.find(item => item.function.name === 'create_beneficiary_transfer').function.parameters;
  assert.deepEqual(beneficiary.properties.notes.type, ['string', 'null']);
  const exportInvoice = tools.find(item => item.function.name === 'export_invoice').function.parameters;
  assert.deepEqual(exportInvoice.properties.format.type, ['string', 'null']);
  assert.deepEqual(exportInvoice.properties.format.enum, ['pdf', 'docx', null]);
});

test('compact tool selection keeps core tools and adds the requested domain', () => {
  const tools = buildTools();
  const names = selected => selected.map(item => item.function.name);

  const core = names(selectTools(tools, 'Bonjour'));
  assert.ok(core.includes('list_clients'));
  assert.ok(core.includes('web_search'));
  assert.ok(core.includes('web_browse'));
  assert.ok(!core.includes('create_client'));

  const invoices = names(selectTools(tools, 'Cree une facture pour Atlas'));
  assert.ok(invoices.includes('create_invoice'));
  assert.ok(invoices.includes('create_client'));
  assert.ok(!invoices.includes('create_container'));

  const containers = names(selectTools(tools, 'Suis le conteneur MSCU1234567 sur Maersk'));
  assert.ok(containers.includes('track_container'));

  const bareContainer = names(selectTools(tools, 'Où est MSCU1234567 ?'));
  assert.ok(bareContainer.includes('track_container'));

  const confirmed = names(selectTools(tools, 'Oui, je confirme', [{
    role: 'assistant',
    tool_calls: JSON.stringify([{ function: { name: 'create_container' } }])
  }]));
  assert.ok(confirmed.includes('create_container'));
});

test('confirmation detection accepts French affirmations but not requests', () => {
  for (const value of ['Oui', 'oui, confirme', "D'accord", 'OK', 'Je confirme', 'Vas-y', "C'est bon", 'Valide']) {
    assert.equal(looksLikeConfirmation(value), true, value);
  }
  for (const value of ['Cree une facture', 'Montre les clients', 'Non', 'Annule', 'Peux-tu faire ?']) {
    assert.equal(looksLikeConfirmation(value), false, value);
  }
});

test('web helpers block private addresses and clean HTML', () => {
  assert.equal(isPrivateIPv4('127.0.0.1'), true);
  assert.equal(isPrivateIPv4('10.20.30.40'), true);
  assert.equal(isPrivateIPv4('192.168.1.5'), true);
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
  assert.equal(isPrivateIPv6('::1'), true);
  assert.equal(isPrivateIPv6('fc00::1'), true);
  assert.equal(isPrivateIPv6('2001:4860:4860::8888'), false);

  const html = '<html><head><title>Tradivia &amp; Co</title><script>alert(1)</script></head><body><h1>Bonjour</h1><p>Facture &euro; 100</p><ul><li>Un</li><li>Deux</li></ul></body></html>';
  assert.equal(extractTitle(html), 'Tradivia & Co');
  const text = htmlToText(html);
  assert.match(text, /Bonjour/);
  assert.match(text, /Facture € 100/);
  assert.match(text, /- Un/);
  assert.doesNotMatch(text, /alert/);
  assert.equal(decodeEntities('&lt;b&gt;x&lt;/b&gt;'), '<b>x</b>');
});
