# No More Cache

A Chrome extension that keeps chosen sites **always fresh** — no stale images,
scripts, or CSS from the browser or a CDN.

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

## Install

1. Download `no-more-cache.zip` from [Releases](../../releases), or clone this repo.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the folder (or unzipped release).

## Use

- Click the toolbar icon.
- Tick **Keep this site always fresh** to watch the current site.
- Or paste a file URL and hit **Check** to diagnose a stale asset.
- Hit **Purge this browser's cache** to force-clear right now.

## How it works

Built on Manifest V3 `declarativeNetRequest` dynamic rules, scoped per host via
`chrome.storage.sync`. No servers, no tracking — everything runs locally.
