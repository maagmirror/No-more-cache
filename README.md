# No More Cache

A Chrome **and Firefox** extension that keeps chosen sites **always fresh** — no
stale images, scripts, or CSS from the browser or a CDN.

## What it does

Pick a site with one checkbox and the extension stops it from ever serving
cached files on this machine:

- **Cache-busts every request** the page makes (adds a unique `_cb` param), so
  the browser and CDN can't reuse an old copy — even for assets loaded from a
  different CDN host.
- **Rewrites response headers** (`cache-control: no-store`, strips `etag` /
  `expires`) so nothing gets stored going forward.
- **Purges on demand** — one button clears this browser's cache, service
  workers, and reloads bypassing cache.

It also has a **checker**: give it a file URL and it downloads it twice (normal
vs. cache-busted) and tells you *where* a stale copy lives — in your browser, or
stuck on the CDN edge (which only a CDN purge can fix).

## Project layout

The same code base builds both browsers. Everything is shared except the
manifest and the background script:

| File                   | Chrome                                    | Firefox                                    |
| ---------------------- | ----------------------------------------- | ------------------------------------------ |
| `manifest.chrome.json` | ✔ (`service_worker`, DNR permission)      | —                                          |
| `manifest.firefox.json`| —                                         | ✔ (`background.scripts`, `webRequest`)     |
| `background.chrome.js` | ✔ `declarativeNetRequest` dynamic rules   | —                                          |
| `background.firefox.js`| —                                         | ✔ blocking `webRequest` + `webNavigation`  |
| `popup.html` / `popup.js` / icons | shared                         | shared                                     |

`popup.js` uses `browser ?? chrome`, so the popup runs unchanged on both.

## Install (development)

**Chrome** — `cp manifest.chrome.json manifest.json`, go to `chrome://extensions`,
enable **Developer mode**, **Load unpacked** → select the folder.

**Firefox** — `cp manifest.firefox.json manifest.json`, go to
`about:debugging#/runtime/this-firefox`, **Load Temporary Add-on…** → pick the
`manifest.json`.

Tagged releases (`v*`) build `no-more-cache-chrome.zip` and
`no-more-cache-firefox.zip` automatically via GitHub Actions.

## Use

- Click the toolbar icon.
- Tick **Keep this site always fresh** to watch the current site.
- Or paste a file URL and hit **Check** to diagnose a stale asset.
- Hit **Purge this browser's cache** to force-clear right now.

## How it works

- **Chrome** — Manifest V3 `declarativeNetRequest` dynamic rules, scoped per
  host via `chrome.storage.sync`.
- **Firefox** — the same behaviour rebuilt on **blocking `webRequest`**
  (`onBeforeRequest` adds `_cb`, `onHeadersReceived` strips the cache headers),
  kept in sync with the host list via `storage.onChanged` and `webNavigation`.
  Firefox is the only MV3 browser that still ships `webRequestBlocking`, which
  is what makes the parity possible.

### Firefox limitations

- `declarativeNetRequest` redirect/modifyHeaders actions aren't available, so
  the logic runs imperatively on blocking `webRequest` instead — same result,
  different mechanism.
- Responses served straight from Firefox's HTTP cache never reach
  `onHeadersReceived`, so their stored headers can't be rewritten in place.
  Because the URL is also cache-busted, those requests miss the cache and are
  re-fetched, so the effective result (always-fresh content) is unchanged.

No servers, no tracking — everything runs locally.
