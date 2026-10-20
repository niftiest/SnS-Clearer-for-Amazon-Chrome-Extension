# Chrome Web Store submission — S&S Clearer for Amazon

Everything to paste into the Developer Dashboard. Upload `dist/amazon-sns-clearer.zip`
under **Package**.

## Store listing

**Title** (from the manifest): S&S Clearer for Amazon

**Summary** (from the manifest, 119/132 chars):
Pick which Amazon Subscribe & Save subscriptions to cancel, then cancel them all in one go. Not affiliated with Amazon.

**Category:** Tools  ·  **Language:** English (United States)

**Contact / support email:** niftypixels@gmail.com (also in `PRIVACY.md`). The
dashboard's developer contact email is set under Account; use this address there if it
isn't already.

**Description:**

```
Cancelling Amazon Subscribe & Save subscriptions one at a time means Edit → Cancel → wait → Confirm, over and over. S&S Clearer does it for you.

HOW IT WORKS
1. Open your Subscribe & Save subscription list on amazon.com.
2. Click the S&S Clearer icon. You'll see every subscription with its photo and title.
3. Tick the ones you want to cancel — or press "All".
4. Review the confirmation screen, then press "Yes, cancel".

S&S Clearer then cancels each selected subscription in turn, exactly as you would by hand. A small panel on the page shows progress, and you can press Stop at any time.

WHY YOU CAN TRUST IT
• Nothing is cancelled until you confirm, and only the items you ticked are touched.
• Each subscription is matched by its unique ID, so look-alike products are never mixed up.
• Runs entirely in your browser. No accounts, no tracking, no data leaves your computer.
• Only works on amazon.com, and only does anything while a run you started is active.

GOOD FOR
• Moving, or pausing household deliveries
• Cleaning up a long list of forgotten subscriptions
• Switching to buying locally

NOTES
• Supports amazon.com (US) Subscribe & Save subscriptions.
• Cancellations are permanent on Amazon's side — you can re-subscribe from the product page.
• If Amazon changes its website, the extension may need an update.

S&S Clearer is an independent tool and is not affiliated with, endorsed by, or sponsored by Amazon. Amazon and Subscribe & Save are trademarks of Amazon.com, Inc. or its affiliates.
```

**Homepage / support URL:**
https://github.com/niftiest/SnS-Clearer-for-Amazon-Chrome-Extension

**Graphics:**
- Store icon (128×128): `extension/icons/icon128.png`
- Screenshots (1280×800): `store/screenshots/1-picker.png`, `2-confirm.png`, `3-progress.png`
- Regenerate all of these with `store/render-assets.ps1`.

## Privacy practices tab

**Single purpose:**
Lets the user choose Amazon Subscribe & Save subscriptions from their subscription list and cancels the chosen ones automatically.

**Permission justifications:**
- `storage` — Saves the in-progress run (the list of subscriptions the user chose and a
  progress count) locally, because each cancellation reloads the Amazon page and the run
  has to resume where it left off.
- Host permission `*://www.amazon.com/*` — The content script reads the user's
  Subscribe & Save list to show it in the popup, and clicks Amazon's own Edit / Cancel /
  Confirm buttons for the subscriptions the user selected. After each cancellation Amazon
  navigates to a confirmation page, so the script must also run there to return to the
  list and continue.

**Remote code:** No, I am not using remote code. All JavaScript is packaged in the extension.

**Data usage:** Check none of the data-type boxes. The extension does not collect or
transmit any user data. (Subscription names and images are read from the page only to
display them in the popup and are never sent anywhere.)

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
https://github.com/niftiest/SnS-Clearer-for-Amazon-Chrome-Extension/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public (or Unlisted to share by link only)
- Regions: United States is enough — it only supports amazon.com.
