# Amazon Subscribe & Save Clearer

A Chrome extension that bulk-cancels **every** Amazon "Subscribe & Save" subscription
on your account, one after another, automatically.

> ⚠️ This permanently cancels all of your Subscribe & Save subscriptions. There is one
> confirmation prompt when you press **Start**; after that it runs unattended until the
> list is empty or you press **Stop**.

## How it works

Each cancellation forwards you to a new page, so the extension is **resumable**: it
keeps its state in `chrome.storage.local` and, on every page load, continues from where
it left off. It always cancels the *first* subscription in the list — the list shrinks
after each one, so "first" is always the next target — until none remain.

Per item it performs: **Edit → Cancel subscription → (wait for the confirm button that
loads ~2s later) → Cancel Subscription**, then returns to the subscription list and
repeats.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder in this repo.
4. Pin the **Amazon S&S Clearer** extension for easy access.

## Use

1. Make sure you're logged in to Amazon.
2. Click the extension icon → **Start** → confirm the warning.
3. It opens your subscription list and begins cancelling. A small overlay (top-right of
   the page) shows progress and has a **Stop** button. The popup also shows a live count.
4. It finishes automatically when no subscriptions remain ("Done! No subscriptions left.").

Press **Stop** (popup or overlay) at any time to halt before the next click.

## Files

```
extension/
  manifest.json   MV3 config
  selectors.js    All Amazon selectors/URLs — the only file to edit if Amazon's markup changes
  content.js      The resumable cancel engine + on-page overlay
  popup.html/js   Start/Stop UI, live status
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
- The content script is inert on every page until you press Start; it only acts while a
  run is active.
- A safety cap (1000 iterations) guards against a runaway loop; normal completion is the
  empty-list check.
