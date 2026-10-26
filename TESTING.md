# Local development and checks

The app has no dependencies and no build step. Serve the repository with:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

The browser calls the W3C, GitHub, and web-specs APIs directly. A GitHub token is optional and kept in this tab's session storage. The Export cache control downloads successful JSON responses without request headers. Commit a fresh export as `demo-cache.json` for the three demo cards' fallback.

Browser regression checks use Playwright as an external development tool, never as an application dependency. With Chromium installed, in a second terminal:

```sh
npm install --prefix /tmp/funder-browser --cache /tmp/npm-cache playwright
NODE_PATH=/tmp/funder-browser/node_modules node tests/dashboard.cjs
NODE_PATH=/tmp/funder-browser/node_modules node tests/offline.cjs
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`, `DASHBOARD_TEST_URL` for another local server, or `DASHBOARD_FIXTURES` for a different cache export. The assertions use the demo facts as recorded on 26 October 2026. Update the dated expectations when deliberately refreshing the demo for a later year.

These tests intercept API traffic using recorded responses and exercise the actual browser UI, aliases, failure isolation, retries, token handling, shared axes, mobile width, projector height, and unavailable-API fallback. They do not establish current API availability or real browser CORS behaviour. Verify live API responses and the published page separately.

A small service worker stores the static page and fallback file after a successful online visit, so a later offline reload can reach `demo-cache.json`. API calls remain direct and always try live data first; the service worker never handles them. A first visit to the remote site with no network cannot download either the app or its cache. For the offline demo, load the site online once and allow the service worker to finish installing before disconnecting. Browser regression scenarios block service workers for deterministic fixtures; test the offline shell separately with an actual offline reload.
