const $url = document.getElementById('url');
const $run = document.getElementById('run');
const $ver = document.getElementById('verdict');
const $hdr = document.getElementById('headers');

const HEADERS = [
  'cache-control',
  'age',
  'cf-cache-status',
  'x-cache',
  'etag',
  'last-modified',
  'content-length',
  'server',
];

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) $url.value = tab.url;
});

async function hash(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function download(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return { res, sum: await hash(await res.arrayBuffer()) };
}

function paint(className, title, detail) {
  $ver.hidden = false;
  $ver.className = className;
  $ver.innerHTML = `<b>${title}</b><span>${detail}</span>`;
}

$run.addEventListener('click', async () => {
  const base = $url.value.trim();
  if (!/^https?:/.test(base)) {
    return paint(
      'edge',
      'Invalid URL',
      'It has to start with http:// or https://'
    );
  }

  $run.disabled = true;
  $run.textContent = 'Checking…';
  $hdr.hidden = true;

  try {
    const busted = new URL(base);
    busted.searchParams.set('_cb', Date.now().toString(36));

    const [clean, fresh] = await Promise.all([
      download(base),
      download(busted.href),
    ]);

    $hdr.hidden = false;
    $hdr.innerHTML =
      HEADERS.map((h) => {
        const v = clean.res.headers.get(h);
        return v ? `<tr><td>${h}</td><td>${v}</td></tr>` : '';
      }).join('') +
      `<tr><td>hash · clean URL</td><td>${clean.sum}</td></tr>` +
      `<tr><td>hash · new URL</td><td>${fresh.sum}</td></tr>`;

    if (clean.sum !== fresh.sum) {
      paint(
        'edge',
        'The old copy is on the CDN',
        'The network returns a different file depending on the URL, so there is ' +
          'an edge serving stale content. Clearing the cache on this machine will ' +
          'not fix it: you have to purge the URL from the CDN panel.'
      );
    } else {
      paint(
        'local',
        'The network serves the correct file',
        'Both downloads are identical, so if you still see the old one it is ' +
          'stored in this browser. Use the purge from the icon.'
      );
    }
  } catch (e) {
    paint('edge', 'Could not check', e.message);
  } finally {
    $run.disabled = false;
    $run.textContent = 'Check';
  }
});

document.getElementById('purge').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Purging…';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (/^https?:/.test(tab?.url || '')) {
    const { origin } = new URL(tab.url);
    await chrome.browsingData.remove(
      { origins: [origin] },
      { cacheStorage: true, serviceWorkers: true }
    );
  }

  await chrome.browsingData.removeCache({ since: 0 });

  if (tab?.id) await chrome.tabs.reload(tab.id, { bypassCache: true });
  window.close();
});

const $chk = document.getElementById('chk');
const $chkLabel = document.getElementById('chkLabel');
let host = null;

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/^https?:/.test(tab?.url || '')) {
    $chk.disabled = true;
    $chkLabel.textContent = 'This tab is not a website';
    return;
  }
  host = new URL(tab.url).hostname;
  $chkLabel.textContent = `Keep ${host} always fresh`;
  const { hosts } = await chrome.storage.sync.get({ hosts: [] });
  $chk.checked = hosts.includes(host);
})();

$chk.addEventListener('change', async () => {
  const { hosts } = await chrome.storage.sync.get({ hosts: [] });
  const next = $chk.checked
    ? [...new Set([...hosts, host])]
    : hosts.filter((h) => h !== host);

  await chrome.storage.sync.set({ hosts: next });

  if ($chk.checked) {
    await chrome.browsingData.removeCache({ since: 0 });
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) chrome.tabs.reload(tab.id, { bypassCache: true });
  }
});
