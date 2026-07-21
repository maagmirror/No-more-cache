// `browser` on Firefox (promises), `chrome` on Chrome — shared popup for both.
const B = globalThis.browser ?? globalThis.chrome;

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

B.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
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
  $ver.replaceChildren();
  const b = document.createElement('b');
  b.textContent = title;
  const span = document.createElement('span');
  span.textContent = detail;
  $ver.append(b, span);
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
    $hdr.replaceChildren();
    const addRow = (k, val) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = k;
      const td2 = document.createElement('td');
      td2.textContent = val;
      tr.append(td1, td2);
      $hdr.append(tr);
    };
    for (const h of HEADERS) {
      const v = clean.res.headers.get(h);
      if (v) addRow(h, v);
    }
    addRow('hash · clean URL', clean.sum);
    addRow('hash · new URL', fresh.sum);

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

  const [tab] = await B.tabs.query({ active: true, currentWindow: true });

  if (/^https?:/.test(tab?.url || '')) {
    const { origin, hostname } = new URL(tab.url);
    try {
      await B.browsingData.remove(
        { origins: [origin] },
        { cacheStorage: true, serviceWorkers: true }
      );
    } catch {
      // Firefox has no cacheStorage/origins granularity; the full wipe below covers it.
      try {
        await B.browsingData.remove(
          { hostnames: [hostname] },
          { serviceWorkers: true }
        );
      } catch {}
    }
  }

  await B.browsingData.removeCache({ since: 0 });

  if (tab?.id) await B.tabs.reload(tab.id, { bypassCache: true });
  window.close();
});

const $chk = document.getElementById('chk');
const $chkLabel = document.getElementById('chkLabel');
let host = null;

(async () => {
  const [tab] = await B.tabs.query({ active: true, currentWindow: true });
  if (!/^https?:/.test(tab?.url || '')) {
    $chk.disabled = true;
    $chkLabel.textContent = 'This tab is not a website';
    return;
  }
  host = new URL(tab.url).hostname;
  $chkLabel.textContent = `Keep ${host} always fresh`;
  const { hosts } = await B.storage.sync.get({ hosts: [] });
  $chk.checked = hosts.includes(host);
})();

$chk.addEventListener('change', async () => {
  const { hosts } = await B.storage.sync.get({ hosts: [] });
  const next = $chk.checked
    ? [...new Set([...hosts, host])]
    : hosts.filter((h) => h !== host);

  await B.storage.sync.set({ hosts: next });

  if ($chk.checked) {
    await B.browsingData.removeCache({ since: 0 });
    const [tab] = await B.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) B.tabs.reload(tab.id, { bypassCache: true });
  }
});
