const RULE_BUST = 1001;
const RULE_HDRS = 1002;
const RULE_HDRS_MAIN = 1003;
const RULE_IDS = [RULE_BUST, RULE_HDRS, RULE_HDRS_MAIN];

const NO_CACHE_HEADERS = [
  {
    header: 'cache-control',
    operation: 'set',
    value: 'no-store, must-revalidate',
  },
  { header: 'expires', operation: 'remove' },
  { header: 'etag', operation: 'remove' },
];

const TYPES = [
  'sub_frame',
  'script',
  'stylesheet',
  'image',
  'font',
  'xmlhttprequest',
  'media',
  'other',
];

const list = async () => (await chrome.storage.sync.get({ hosts: [] })).hosts;

async function applyRules(stamp = Date.now().toString(36)) {
  const hosts = await list();

  if (!hosts.length) {
    return chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: RULE_IDS,
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: RULE_IDS,
    addRules: [
      {
        id: RULE_BUST,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            transform: {
              queryTransform: {
                addOrReplaceParams: [{ key: '_cb', value: stamp }],
              },
            },
          },
        },
        condition: { initiatorDomains: hosts, resourceTypes: TYPES },
      },
      {
        id: RULE_HDRS,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: NO_CACHE_HEADERS },
        condition: { initiatorDomains: hosts, resourceTypes: TYPES },
      },
      {
        id: RULE_HDRS_MAIN,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: NO_CACHE_HEADERS },
        condition: { requestDomains: hosts, resourceTypes: ['main_frame'] },
      },
    ],
  });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  try {
    const { hostname } = new URL(d.url);
    if ((await list()).includes(hostname)) await applyRules();
  } catch {}
});

chrome.runtime.onStartup.addListener(() => applyRules());
chrome.runtime.onInstalled.addListener(() => applyRules());
chrome.storage.onChanged.addListener((c) => c.hosts && applyRules());
