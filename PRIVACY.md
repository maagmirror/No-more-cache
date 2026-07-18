# Privacy Policy — No More Cache

_Last updated: 18 July 2026_

**No More Cache does not collect, store, transmit, or sell any personal data.**

Everything the extension does runs locally in your own browser. There are no
servers, no analytics, no tracking, and no third parties.

## What data the extension handles

- **List of sites you choose to keep fresh.** When you tick "Keep this site
  always fresh", the site's hostname is saved with `chrome.storage.sync` so the
  setting follows your Chrome profile. This list stays in your browser / Google
  account and is never sent to us or anyone else.
- **Nothing else is stored.** URLs you check, page contents, and request headers
  are used in memory only to perform the requested action and are discarded
  immediately.

## Why the permissions are requested

- **browsingData** — clear this browser's cache, cacheStorage, and service
  workers when you press Purge.
- **tabs** — read the active tab's URL to prefill the checker and reload after a
  purge.
- **storage** — save the list of sites you chose to keep fresh.
- **webNavigation** — refresh the no-cache rules when you visit a watched site.
- **declarativeNetRequestWithHostAccess** and host access — apply cache-busting
  and header-rewrite rules to the sites you choose.

## Data sharing

None. No data ever leaves your device except your own site list syncing through
your Google account (handled by Chrome, not by us).

## Contact

Questions: **contacto@nibiru.com.uy**
