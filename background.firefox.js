// Firefox (MV3) port of background.chrome.js. Firefox has no declarativeNetRequest
// redirect/modifyHeaders, but still ships blocking webRequest (webRequestBlocking),
// so the same behaviour is done imperatively.

const B = globalThis.browser ?? globalThis.chrome;

// main_frame excluded on purpose: the top navigation URL is left untouched.
const BUST_TYPES = [
  'sub_frame',
  'script',
  'stylesheet',
  'image',
  'font',
  'xmlhttprequest',
  'media',
  'other',
];
const HDR_TYPES = ['main_frame', ...BUST_TYPES];

// null until the first async load resolves; rebuilt whenever the event page wakes.
let HOSTS = null;
let hostsReady = loadHosts();

async function loadHosts() {
  const { hosts } = await B.storage.sync.get({ hosts: [] });
  HOSTS = new Set(hosts);
  return HOSTS;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function initiatorHost(d) {
  const u = d.documentUrl || d.originUrl;
  return u ? hostOf(u) : null;
}

function bust(d, hosts) {
  const ih = initiatorHost(d);
  if (!ih || !hosts.has(ih)) return;
  const url = new URL(d.url);
  if (url.searchParams.has('_cb')) return; // already busted -> avoid redirect loop
  url.searchParams.set('_cb', Date.now().toString(36));
  return { redirectUrl: url.href };
}

B.webRequest.onBeforeRequest.addListener(
  (d) => (HOSTS ? bust(d, HOSTS) : hostsReady.then((h) => bust(d, h))),
  { urls: ['<all_urls>'], types: BUST_TYPES },
  ['blocking']
);

function stripHeaders(d, hosts) {
  if (!d.responseHeaders) return;

  const watched =
    d.type === 'main_frame'
      ? hosts.has(hostOf(d.url))
      : hosts.has(initiatorHost(d));
  if (!watched) return;

  const headers = d.responseHeaders.filter((h) => {
    const n = h.name.toLowerCase();
    return n !== 'cache-control' && n !== 'expires' && n !== 'etag';
  });
  headers.push({ name: 'Cache-Control', value: 'no-store, must-revalidate' });

  return { responseHeaders: headers };
}

B.webRequest.onHeadersReceived.addListener(
  (d) =>
    HOSTS ? stripHeaders(d, HOSTS) : hostsReady.then((h) => stripHeaders(d, h)),
  { urls: ['<all_urls>'], types: HDR_TYPES },
  ['blocking', 'responseHeaders']
);

B.storage.onChanged.addListener((changes) => {
  if (changes.hosts) hostsReady = loadHosts();
});

B.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0) hostsReady = loadHosts();
});

B.runtime.onStartup.addListener(() => {
  hostsReady = loadHosts();
});

B.runtime.onInstalled.addListener(() => {
  hostsReady = loadHosts();
});
