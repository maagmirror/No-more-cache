// background.firefox.js
// Firefox (Manifest V3) port of the Chrome `declarativeNetRequest` logic in
// background.chrome.js. It reproduces the exact same behaviour.
//
// Chrome relies on chrome.declarativeNetRequest (declarative redirect +
// header-rewrite rules). Firefox does not expose the same DNR redirect /
// modifyHeaders actions, but — unlike Chrome — it still ships *blocking*
// webRequest in MV3 (behind the "webRequestBlocking" permission), which lets
// us do the same thing imperatively:
//
//   * add a `_cb=<timestamp>` query param to every sub-resource request of a
//     watched domain          ->  webRequest.onBeforeRequest  ({ redirectUrl })
//   * remove / overwrite the cache headers (Cache-Control, ETag, Expires) on
//     the responses of watched domains
//                             ->  webRequest.onHeadersReceived ({ responseHeaders })
//   * keep the watch-list in sync with storage.sync
//                             ->  storage.onChanged + webNavigation
//
// Known Firefox limitations vs. Chrome DNR (see README):
//   1. declarativeNetRequest is not used; the equivalent needs blocking
//      webRequest, which is only possible because Firefox keeps
//      "webRequestBlocking" in MV3 (Chrome removed it).
//   2. A response served straight from Firefox's HTTP cache never reaches
//      onHeadersReceived, so its stored headers can't be rewritten in place.
//      Because we also cache-bust the URL, that request misses the cache and
//      is re-fetched, so the end result (always-fresh content) is identical.
//   3. Header rewriting can only touch headers the origin actually returns; it
//      cannot force a shared/CDN edge to drop its own copy — same as Chrome.
//      The `_cb` param is what defeats the edge cache in both browsers.

const B = globalThis.browser ?? globalThis.chrome;

// Sub-resource types we cache-bust. Mirrors TYPES in background.chrome.js —
// `main_frame` is intentionally excluded so the top navigation URL is left
// untouched, exactly like the Chrome RULE_BUST condition.
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

// Header rewriting additionally covers the top document (RULE_HDRS_MAIN).
const HDR_TYPES = ['main_frame', ...BUST_TYPES];

// In-memory copy of the watch-list. `null` until the first async load resolves;
// the background page is non-persistent, so it is rebuilt every time the page
// wakes up.
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

// Hostname of the document that initiated the request (its "initiator").
function initiatorHost(d) {
  const u = d.documentUrl || d.originUrl;
  return u ? hostOf(u) : null;
}

// --- cache busting -------------------------------------------------------

function bust(d, hosts) {
  const ih = initiatorHost(d);
  if (!ih || !hosts.has(ih)) return; // only requests from a watched page
  const url = new URL(d.url);
  if (url.searchParams.has('_cb')) return; // already busted -> avoid redirect loop
  url.searchParams.set('_cb', Date.now().toString(36));
  return { redirectUrl: url.href };
}

B.webRequest.onBeforeRequest.addListener(
  // Fast path once HOSTS is loaded (synchronous BlockingResponse). Right after
  // the event page wakes up we return a Promise instead — Firefox supports
  // async blocking listeners — so the very first requests are handled too.
  (d) => (HOSTS ? bust(d, HOSTS) : hostsReady.then((h) => bust(d, h))),
  { urls: ['<all_urls>'], types: BUST_TYPES },
  ['blocking']
);

// --- header rewriting ----------------------------------------------------

function stripHeaders(d, hosts) {
  if (!d.responseHeaders) return;

  const watched =
    d.type === 'main_frame'
      ? hosts.has(hostOf(d.url)) // top document: match the request host
      : hosts.has(initiatorHost(d)); // sub-resource: match the initiator host
  if (!watched) return;

  const headers = d.responseHeaders.filter((h) => {
    const n = h.name.toLowerCase();
    return n !== 'cache-control' && n !== 'expires' && n !== 'etag';
  });
  headers.push({ name: 'Cache-Control', value: 'no-store, must-revalidate' });

  return { responseHeaders: headers };
}

B.webRequest.onHeadersReceived.addListener(
  (d) => (HOSTS ? stripHeaders(d, HOSTS) : hostsReady.then((h) => stripHeaders(d, h))),
  { urls: ['<all_urls>'], types: HDR_TYPES },
  ['blocking', 'responseHeaders']
);

// --- keep the watch-list current -----------------------------------------

// Re-read the list whenever it changes (mirrors storage.onChanged in the
// Chrome build) and whenever a top-level navigation targets a watched host.
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
