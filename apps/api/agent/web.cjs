const dns = require('dns').promises;
const net = require('net');
const fs = require('fs');

const DEFAULT_TIMEOUT = 20000;
const MAX_REDIRECTS = 3;
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].filter(Boolean);

function ipv4ToInt(ip) {
  return ip.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const value = ipv4ToInt(ip);
  const ranges = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
  ];
  return ranges.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8');
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('URL invalide'), { code: 'INVALID_URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Seules les URL HTTP et HTTPS sont autorisees'), { code: 'INVALID_URL' });
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if ((net.isIP(hostname) === 4 && isPrivateIPv4(hostname))
      || (net.isIP(hostname) === 6 && isPrivateIPv6(hostname))) {
      throw Object.assign(new Error('Cette adresse reseau privee est interdite'), { code: 'PRIVATE_ADDRESS' });
    }
    return parsed;
  }
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(hostname)) {
    throw Object.assign(new Error('Cette adresse reseau privee est interdite'), { code: 'PRIVATE_ADDRESS' });
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw Object.assign(new Error('Nom de domaine introuvable'), { code: 'DNS_NOT_FOUND' });
  for (const address of addresses) {
    if ((address.family === 4 && isPrivateIPv4(address.address))
      || (address.family === 6 && isPrivateIPv6(address.address))) {
      throw Object.assign(new Error('Cette adresse reseau privee est interdite'), { code: 'PRIVATE_ADDRESS' });
    }
  }
  return parsed;
}

const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  euro: '€', pound: '£', dollar: '$', yen: '¥', cent: '¢',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•',
  copy: '©', reg: '®', trade: '™', deg: '°', times: '×', divide: '÷',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aelig: 'Æ',
  Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', Ntilde: 'Ñ',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý'
};

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function htmlToText(html) {
  const withoutNoise = String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withBreaks = withoutNoise
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre|table)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withBreaks)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
}

async function readLimitedText(response, maxBytes = 3 * 1024 * 1024) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw Object.assign(new Error('La page est trop volumineuse pour etre lue'), { code: 'TOO_LARGE' });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw Object.assign(new Error('La page est trop volumineuse pour etre lue'), { code: 'TOO_LARGE' });
  }
  return buffer.toString('utf8');
}

async function webFetch(rawUrl, options = {}) {
  const maxChars = Math.min(Math.max(Number(options.maxChars) || 12000, 1000), 30000);
  const timeout = Math.min(Math.max(Number(options.timeout) || DEFAULT_TIMEOUT, 5000), 45000);
  let currentUrl = String(rawUrl || '').trim();
  if (!currentUrl) throw Object.assign(new Error('URL requise'), { code: 'INVALID_URL' });

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const parsed = await assertPublicUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetch(parsed.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'TradiviaAgent/1.0 (+local business assistant)',
          Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5'
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw Object.assign(new Error('Le site web ne repond pas (delai depasse)'), { code: 'TIMEOUT' });
      }
      throw Object.assign(new Error(`Impossible de contacter le site : ${error.message}`), { code: 'FETCH_FAILED' });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw Object.assign(new Error('Redirection invalide'), { code: 'REDIRECT_FAILED' });
      currentUrl = new URL(location, parsed).href;
      continue;
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Le site a repondu avec le statut HTTP ${response.status}`), { code: 'HTTP_ERROR' });
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyText = await readLimitedText(response);
    const title = extractTitle(bodyText);
    const text = contentType.includes('html') || /<html|<body|<p\b/i.test(bodyText)
      ? htmlToText(bodyText)
      : bodyText.trim();
    return {
      url: parsed.href,
      final_url: currentUrl,
      title,
      content_type: contentType,
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars
    };
  }

  throw Object.assign(new Error('Trop de redirections'), { code: 'REDIRECT_FAILED' });
}

function unwrapDuckDuckGo(url) {
  try {
    const parsed = new URL(url, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : parsed.href;
  } catch {
    return url;
  }
}

async function tavilySearch(query, maxResults) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: maxResults, include_answer: true, search_depth: 'basic' })
  });
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const data = await response.json();
  return {
    provider: 'tavily',
    answer: data.answer || '',
    results: (data.results || []).slice(0, maxResults).map(item => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || ''
    }))
  };
}

async function duckDuckGoSearch(query, maxResults) {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      Accept: 'text/html'
    }
  });
  if (!response.ok) throw new Error(`DuckDuckGo HTTP ${response.status}`);
  const html = await response.text();
  const blocks = html.split(/<div class="result results_links/).slice(1);
  const results = [];
  for (const block of blocks) {
    if (results.length >= maxResults) break;
    const link = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const snippetMatch = block.match(/<(?:a|td)[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)>/i);
    results.push({
      title: htmlToText(link[2]),
      url: unwrapDuckDuckGo(decodeEntities(link[1])),
      snippet: snippetMatch ? htmlToText(snippetMatch[1]) : ''
    });
  }
  return { provider: 'duckduckgo', answer: '', results };
}

async function webSearch(query, options = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw Object.assign(new Error('Requete de recherche vide'), { code: 'INVALID_QUERY' });
  const maxResults = Math.min(Math.max(Number(options.maxResults) || 5, 1), 10);
  if (process.env.TAVILY_API_KEY) {
    try {
      const result = await tavilySearch(cleanQuery, maxResults);
      if (result && result.results.length) return result;
    } catch {}
  }
  return duckDuckGoSearch(cleanQuery, maxResults);
}

function findBrowserExecutable() {
  return BROWSER_CANDIDATES.find(candidate => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) || null;
}

async function openBrowserContext(options = {}) {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw Object.assign(new Error('Aucun navigateur Chrome ou Edge trouve. Definis CHROME_PATH.'), { code: 'BROWSER_NOT_FOUND' });
  }

  let chromium;
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    throw Object.assign(new Error('Le module playwright-core est absent. Lance npm install.'), { code: 'BROWSER_NOT_INSTALLED' });
  }

  const browser = await chromium.launch({
    executablePath,
    headless: options.headless !== false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  }).catch(error => {
    throw Object.assign(new Error(`Impossible de demarrer le navigateur : ${error.message}`), { code: 'BROWSER_LAUNCH_FAILED' });
  });

  try {
    const context = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: 1365, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' }
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await context.route('**/*', route => {
      try {
        const hostname = new URL(route.request().url()).hostname.replace(/^\[|\]$/g, '');
        const family = net.isIP(hostname);
        const blocked = /^(localhost|.*\.local|.*\.internal)$/i.test(hostname)
          || (family === 4 && isPrivateIPv4(hostname))
          || (family === 6 && isPrivateIPv6(hostname));
        if (blocked) return route.abort();
      } catch {}
      return route.continue();
    });
    return { browser, context };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function webBrowse(rawUrl, options = {}) {
  const maxChars = Math.min(Math.max(Number(options.maxChars) || 12000, 1000), 30000);
  const timeout = Math.min(Math.max(Number(options.timeout) || 30000, 5000), 60000);
  const target = await assertPublicUrl(String(rawUrl || '').trim());
  const { browser, context } = await openBrowserContext(options);

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    let waitForWarning = null;

    let response;
    try {
      response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
      throw Object.assign(new Error(`Le site web ne repond pas : ${error.message}`), { code: 'BROWSE_FAILED' });
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {}

    if (options.waitFor) {
      try {
        await page.waitForSelector(String(options.waitFor), { state: 'attached', timeout: 15000 });
      } catch {
        waitForWarning = `Element introuvable : ${options.waitFor}`;
      }
    }

    const actions = Array.isArray(options.actions) ? options.actions.slice(0, 10) : [];
    for (const action of actions) {
      const type = String(action && action.type || '');
      const selector = action && action.selector ? String(action.selector) : '';
      if (type === 'fill' && selector) {
        await page.fill(selector, String(action.value ?? ''));
      } else if (type === 'click' && selector) {
        await page.click(selector);
      } else if (type === 'press' && selector) {
        await page.press(selector, String(action.key || 'Enter'));
      } else if (type === 'wait') {
        await page.waitForTimeout(Math.min(Math.max(Number(action.ms) || 1000, 100), 10000));
      }
    }

    await page.waitForTimeout(800);
    const finalUrl = page.url();
    await assertPublicUrl(finalUrl);
    const title = await page.title();
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return {
      url: target.href,
      final_url: finalUrl,
      title,
      status: response ? response.status() : null,
      text: normalized.slice(0, maxChars),
      truncated: normalized.length > maxChars,
      warning: waitForWarning,
      browser: 'chrome'
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function trackContainer(rawContainer, options = {}) {
  const carrier = String(options.carrier || 'maersk').toLowerCase();
  if (carrier !== 'maersk') {
    throw Object.assign(new Error('Seul le suivi Maersk est disponible pour le moment'), { code: 'CARRIER_UNSUPPORTED' });
  }
  const container = String(rawContainer || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!container || container.length > 30) {
    throw Object.assign(new Error('Numero de conteneur ou de BL invalide'), { code: 'INVALID_CONTAINER' });
  }
  const timeout = Math.min(Math.max(Number(options.timeout) || 45000, 5000), 60000);
  const targetUrl = `https://www.maersk.com/tracking/${encodeURIComponent(container)}`;
  await assertPublicUrl(targetUrl);
  const { browser, context } = await openBrowserContext(options);

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    const apiResponsePromise = page.waitForResponse(
      response => response.url().includes('api.maersk.com/synergy/tracking/'),
      { timeout: 20000 }
    ).catch(() => null);

    let pageResponse;
    try {
      pageResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
    } catch (error) {
      throw Object.assign(new Error(`Le site Maersk ne repond pas : ${error.message}`), { code: 'TRACKING_FAILED' });
    }

    const apiResponse = await apiResponsePromise;
    let apiStatus = null;
    let tracking = null;
    if (apiResponse) {
      apiStatus = apiResponse.status();
      try {
        tracking = await apiResponse.json();
      } catch {
        tracking = { raw: (await apiResponse.text().catch(() => '')).slice(0, 4000) };
      }
    }

    await page.waitForTimeout(1500);
    const finalUrl = page.url();
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return {
      container,
      carrier: 'maersk',
      url: targetUrl,
      final_url: finalUrl,
      page_status: pageResponse ? pageResponse.status() : null,
      api_status: apiStatus,
      found: apiStatus === 200,
      tracking,
      page_text: normalized.slice(0, 4000)
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  webFetch,
  webSearch,
  webBrowse,
  trackContainer,
  findBrowserExecutable,
  htmlToText,
  extractTitle,
  assertPublicUrl,
  isPrivateIPv4,
  isPrivateIPv6,
  decodeEntities
};
