# S&S Clearer for Amazon

A Chrome extension that bulk-cancels the Amazon "Subscribe & Save" subscriptions you
pick (or all of them), one after another, automatically.

> ⚠️ This permanently cancels the Subscribe & Save subscriptions you select. There is one
> confirmation prompt when you press **Cancel selected**; after that it runs unattended
> until every selected item is done or you press **Stop**.

## How it works

Each cancellation forwards you to a new page, so the extension is **resumable**: it
keeps its state in `chrome.storage.local` and, on every page load, continues from where
it left off. It works through a queue of the subscription ids you checked in the popup,
finding each one's tile by id, until the queue is empty.

Per item it performs: **Edit → Cancel subscription → (wait for the confirm button that
loads ~2s later) → Cancel Subscription**, then returns to the subscription list and
repeats.

## Install from source (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder in this repo.
4. Pin the **S&S Clearer for Amazon** extension for easy access.

## Use

1. Make sure you're logged in to Amazon.
2. Click the extension icon. If you're not on your subscription list, click
   **Open subscription list**, then click the icon again.
3. The popup lists every subscription (checkbox, photo, title). Tick the ones to cancel,
   or use **All** / **None**, then click **Cancel N selected** and confirm.
4. A small overlay (top-right of the page) shows progress and has a **Stop** button. The
   popup also shows a live count. Only the checked subscriptions are touched; each is
   targeted by its subscription id, so identical-looking items aren't mixed up.

Press **Stop** (popup or overlay) at any time to halt before the next click.

## Files

```
extension/
  manifest.json   MV3 config
  selectors.js    All Amazon selectors/URLs — the only file to edit if Amazon's markup changes
  content.js      The resumable cancel engine + on-page overlay
  popup.html/js   Subscription picker, confirmation step, live status
  icons/          Toolbar/store icons (rendered from store/src/icon.svg)
store/
  render-assets.ps1   Re-renders the icons, screenshots and promo tiles with headless Chrome
  screenshots/        1280x800 Chrome Web Store screenshots
  promo/              440x280 small and 1400x560 marquee promo tiles
  src/                Icon SVG + screenshot/promo templates (mock data)
STORE_LISTING.md      Copy and answers for the Chrome Web Store dashboard
PRIVACY.md            Privacy policy (linked from the store listing)
build-zip.ps1         Builds dist/amazon-sns-clearer.zip for upload
```

## Re-capturing selectors (if Amazon changes its page)

The selectors in `selectors.js` were captured with the recorder under
`tools/recorder/`. To refresh them:

```
cd tools/recorder
npm install
node recorder.js
```

Drive the cancel flow once; selectors/HTML/navigations are logged to
`tools/recorder/logs/`. Update `extension/selectors.js` from those logs.

## Notes & limits

- Only cancels Subscribe & Save (`auto-deliveries`) subscriptions — no other Amazon
  subscription types.
- The content script is inert on every page until you confirm a run; it only acts while a
  run is active.
- A safety cap (1000 iterations) guards against a runaway loop; normal completion is an
  empty queue.

## Privacy

S&S Clearer collects no data and makes no network requests of its own. See
[PRIVACY.md](PRIVACY.md).

## Disclaimer

S&S Clearer is an independent tool and is not affiliated with, endorsed by, or sponsored
by Amazon. Amazon and Subscribe & Save are trademarks of Amazon.com, Inc. or its
affiliates. Cancellations are permanent; use at your own risk.

## License

[MIT](LICENSE)
