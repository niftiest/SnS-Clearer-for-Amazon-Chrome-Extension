# Amazon Subscribe & Save Clearer — Chrome Extension Design

**Date:** 2026-06-14
**Status:** Approved (design); selectors pending Playwright capture

## Purpose

A Manifest V3 Chrome extension that bulk-cancels every Amazon "Subscribe & Save"
subscription on the user's account, starting from:

```
https://www.amazon.com/auto-deliveries/subscriptionList?ref_=sns_discover_m_d_nav_mys
```

For each subscription it performs: **Edit → Cancel Subscription → (confirm button
appears ~2s later) → Cancel Subscription (confirm)**. Confirming triggers a full
page navigation to another page, so the extension returns to the subscription list
URL and repeats until no subscriptions remain.

## Decisions (from brainstorming)

- **Execution mode:** Fully automatic. One confirmation gate when the user presses
  Start ("This will cancel ALL subscriptions — confirm?"). After that, no per-item
  prompts.
- **Scope:** Cancel every subscription. No skipping, no allow/deny list.
- **Element waiting:** Smart wait (poll for elements up to a timeout), not a fixed
  2-second sleep.
- **Navigation model:** Confirming a cancellation loads a whole new page (confirmed
  by user). The extension is therefore resumable across page loads.
- **Selectors:** Sourced from a real Playwright run; until then, primary strategy is
  resilient visible-text matching, kept in one config file for easy override.

## Architecture

The defining constraint: each cancellation navigates off the list page, destroying
the content script. The extension cannot run as one long loop — it must be
**resumable**. All state lives in `chrome.storage.local`; the content script re-reads
it on every page load and continues.

### Loop model: "operate-on-first-item + navigate-back"

- Always act on the **first** subscription in the list. After one is cancelled the
  list shrinks, so "first" is always the next target — no index tracking.
- A `running` flag in storage drives behavior. The content script runs on every
  `auto-deliveries` page load and branches:
  - **On the subscription list page:** find first subscription → click Edit → click
    "Cancel Subscription" → smart-wait for confirm button → click confirm. Page
    navigates away.
  - **On any other auto-deliveries page** (post-cancel forward page): treat as a
    transit stop → redirect back to the subscription list URL.
- **Stop conditions:**
  1. No subscriptions found on the list → done; clear flag; show summary.
  2. Safety cap on total iterations (default 50) → stop; report.
  3. A required element never appears within the smart-wait timeout → stop; report
     which step failed.

## Components

- **`manifest.json`** — MV3. Content script matched to
  `*://www.amazon.com/auto-deliveries/*`. Permissions: `storage`. Declares popup.
- **`selectors.js`** — single config block, filled from the Playwright run:
  list-item container, item name, Edit trigger, "Cancel Subscription" menu item,
  confirm button, empty-list marker. Each entry supports CSS selector and/or
  visible-text match.
- **`content.js`** — resumable state machine + `waitForElement(selector, timeout)`
  smart-wait helper. Injects the floating overlay.
- **`popup.html` / `popup.js`** — Start / Stop buttons, live cancelled count, the
  single Start confirmation gate.
- **Floating on-page overlay** — shows "Cancelling… X done" and a Stop button so the
  run is visible and abortable mid-flight.

## Smart wait & safety

- `waitForElement` polls (~200ms interval, ~10s default timeout) instead of sleeping.
- Every click is wrapped: a missing element stops the run cleanly instead of hanging.
- Stop (popup or overlay) instantly clears `running`, halting on the next page tick.
- Iteration cap prevents an infinite navigate-back loop if detection misbehaves.

## State shape (`chrome.storage.local`)

```
{
  running: boolean,        // master switch
  cancelledCount: number,  // for the summary + overlay
  iterations: number,      // against the safety cap
  lastError: string|null,  // populated on a stop-on-failure
  startedAt: number        // timestamp
}
```

## Playwright capture checklist (to fill `selectors.js`)

1. Subscription **list page** DOM: repeating container for one subscription + how to
   read its name/title.
2. **Edit control** — button / link / dropdown toggle? Selector + visible text.
3. **"Cancel Subscription" menu item** that appears after Edit — selector + text.
4. **Confirm "Cancel Subscription" button** (shows ~2s later) — selector + text +
   the modal/container it lives in.
5. The **URL it forwards to** after confirming.
6. The **empty state** when no subscriptions remain — element/message to detect "done".

## Out of scope

- Other Amazon subscription types (Prime, digital, etc.).
- Pausing/skipping deliveries (only full cancellation).
- Any account beyond the logged-in user in the active browser session.
