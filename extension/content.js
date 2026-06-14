/*
 * Resumable cancellation engine.
 *
 * Each cancellation ends in a full page navigation, which destroys this script.
 * So the loop is driven by state in chrome.storage.local: on EVERY page load we
 * read it and continue. Always act on the FIRST subscription — the list shrinks
 * after each cancel, so "first" is always the next one.
 */
(() => {
  const S = window.SNS_SELECTORS;
  const KEY = 'snsClearerState';
  const MAX_ITER = 1000; // runaway guard; real stop is "no Edit buttons left"
  let aborted = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getState() {
    const o = await chrome.storage.local.get(KEY);
    return o[KEY] || {};
  }
  async function setState(patch) {
    const next = Object.assign({}, await getState(), patch);
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  }

  const onListPage = () => location.pathname.startsWith(S.listPathPrefix);
  const isVisible = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const firstVisible = (selector) =>
    Array.prototype.find.call(document.querySelectorAll(selector), isVisible) || null;

  async function waitForElement(selector, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (aborted) return null;
      const el = document.querySelector(selector);
      if (isVisible(el)) return el;
      await sleep(200);
    }
    return null;
  }

  // ---------- on-page overlay ----------
  let overlayEl = null;
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    const el = document.createElement('div');
    el.id = 'sns-clearer-overlay';
    el.style.cssText = [
      'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
      'background:#131921', 'color:#fff', 'font:13px/1.4 Arial,sans-serif',
      'padding:12px 14px', 'border-radius:8px',
      'box-shadow:0 4px 16px rgba(0,0,0,.4)', 'max-width:280px'
    ].join(';');
    el.innerHTML =
      '<div style="font-weight:bold;margin-bottom:6px">S&amp;S Clearer</div>' +
      '<div id="sns-clearer-msg">Idle</div>' +
      '<div id="sns-clearer-count" style="margin-top:6px;opacity:.85"></div>' +
      '<button id="sns-clearer-stop" style="margin-top:8px;background:#e47911;' +
      'border:0;color:#111;font-weight:bold;padding:6px 10px;border-radius:4px;' +
      'cursor:pointer">Stop</button>';
    document.documentElement.appendChild(el);
    el.querySelector('#sns-clearer-stop').addEventListener('click', () =>
      stop('Stopped by user.')
    );
    overlayEl = el;
    return el;
  }
  function setMsg(msg, count) {
    const el = ensureOverlay();
    el.querySelector('#sns-clearer-msg').textContent = msg;
    if (count != null) {
      el.querySelector('#sns-clearer-count').textContent = 'Cancelled: ' + count;
    }
  }

  async function stop(reason, isDone) {
    aborted = true;
    const s = await setState({
      running: false,
      lastError: isDone ? null : reason || null,
      lastMessage: reason || null
    });
    setMsg(reason || 'Stopped.', s.cancelledCount || 0);
  }

  async function runOneCancellation() {
    const s = await getState();
    if ((s.iterations || 0) >= MAX_ITER) {
      await stop('Safety cap reached (' + MAX_ITER + ').');
      return;
    }

    const editBtn = firstVisible(S.editButton);
    if (!editBtn) {
      await setState({ running: false, lastMessage: 'Done.' });
      setMsg('Done! No subscriptions left.', s.cancelledCount || 0);
      return;
    }

    const name =
      (editBtn.getAttribute('aria-label') || '')
        .replace(/^Edit,\s*/i, '')
        .trim() || 'subscription';
    setMsg('Cancelling: ' + name, s.cancelledCount || 0);

    editBtn.click();

    const cancelLink = await waitForElement(S.cancelMenuItem, 10000);
    if (aborted) return;
    if (!cancelLink) {
      await stop('Could not find the "Cancel subscription" menu item.');
      return;
    }
    cancelLink.click();

    const confirmBtn = await waitForElement(S.confirmButton, 12000);
    if (aborted) return;
    if (!confirmBtn) {
      await stop('The cancel confirmation button never appeared.');
      return;
    }

    const next = await setState({
      iterations: (s.iterations || 0) + 1,
      cancelledCount: (s.cancelledCount || 0) + 1,
      lastCancelled: name
    });
    setMsg('Confirmed: ' + name + '. Continuing…', next.cancelledCount);
    confirmBtn.click();

    // Confirm normally navigates to a completion page (handled on next load).
    // Fallback: if we're somehow still here after 7s, force back to the list.
    await sleep(7000);
    if (aborted) return;
    const still = await getState();
    if (still.running && onListPage()) location.href = S.listUrl;
  }

  async function main() {
    const s = await getState();
    if (!s.running) return; // inert on every page unless a run is active

    aborted = false;
    setMsg('Running…', s.cancelledCount || 0);

    if (!onListPage()) {
      // Post-cancel completion/transit page: bounce back to the list to continue.
      setMsg('Returning to subscription list…', s.cancelledCount || 0);
      await sleep(600);
      if (aborted) return;
      location.href = S.listUrl;
      return;
    }

    await runOneCancellation();
  }

  // Honor Stop pressed in the popup or another tab.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    const nv = changes[KEY].newValue || {};
    if (nv.running === false) {
      aborted = true;
      if (overlayEl) setMsg(nv.lastMessage || 'Stopped.', nv.cancelledCount || 0);
    }
  });

  main();
})();
