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
  function removeOverlay() {
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
  }
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
      '<button id="sns-clearer-btn" style="margin-top:8px;background:#e47911;' +
      'border:0;color:#111;font-weight:bold;padding:6px 10px;border-radius:4px;' +
      'cursor:pointer">Stop</button>';
    document.documentElement.appendChild(el);
    el.querySelector('#sns-clearer-btn').addEventListener('click', () => {
      // While running the button stops the run; otherwise it dismisses the overlay.
      if (overlayEl && overlayEl.dataset.mode === 'close') removeOverlay();
      else stop('Stopped by user.');
    });
    overlayEl = el;
    return el;
  }
  // mode: 'stop' (running) shows a Stop button; 'close' (idle/done) shows Close.
  function setButtonMode(mode) {
    const el = ensureOverlay();
    el.dataset.mode = mode;
    const btn = el.querySelector('#sns-clearer-btn');
    btn.textContent = mode === 'close' ? 'Close' : 'Stop';
    btn.style.background = mode === 'close' ? '#e7e9ec' : '#e47911';
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
    setButtonMode('close');
  }

  // ---------- subscription tiles ----------
  const tileId = (tile) => {
    const m = (tile.getAttribute(S.tileIdAttr) || '').match(S.tileIdPattern);
    return m ? m[1] : null;
  };
  const tileName = (tile) => {
    const el = tile.querySelector(S.tileName);
    return (el ? el.textContent : '').trim() || 'subscription';
  };
  const findTile = (id) =>
    Array.prototype.find.call(document.querySelectorAll(S.tile), (t) => tileId(t) === id) ||
    null;

  // The tile grid renders after document_idle, so poll briefly before giving up.
  async function waitFor(fn, timeout) {
    for (const start = Date.now(); Date.now() - start < timeout; await sleep(250)) {
      if (aborted) return null;
      const v = fn();
      if (v) return v;
    }
    return null;
  }

  async function scanTiles() {
    await waitFor(() => document.querySelector(S.tile), 8000);
    const seen = new Set();
    const items = [];
    document.querySelectorAll(S.tile).forEach((t) => {
      const id = tileId(t);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const img = t.querySelector(S.tileImage);
      items.push({ id, name: tileName(t), img: img ? img.src : null });
    });
    return items;
  }

  async function runOneCancellation() {
    const s = await getState();
    if ((s.iterations || 0) >= MAX_ITER) {
      await stop('Safety cap reached (' + MAX_ITER + ').');
      return;
    }

    const queue = s.queue || [];
    const total = s.total || queue.length;
    const done = total - queue.length + 1; // 1-based position of this item
    if (!queue.length) {
      const skipped = (s.skipped || []).length;
      await setState({ running: false, lastMessage: 'Done.' });
      setMsg(
        'Done! Cancelled all selected subscriptions.' +
          (skipped ? ' (' + skipped + ' not found on the page.)' : ''),
        s.cancelledCount || 0
      );
      setButtonMode('close');
      return;
    }

    const id = queue[0];
    const name = (s.names && s.names[id]) || 'subscription';
    const tile = await waitFor(() => findTile(id), 8000);
    if (aborted) return;
    if (!tile) {
      // Already gone (cancelled elsewhere?) — skip it and move on.
      await setState({
        queue: queue.slice(1),
        skipped: (s.skipped || []).concat(name),
        iterations: (s.iterations || 0) + 1
      });
      return runOneCancellation();
    }

    const editBtn = tile.querySelector(S.editButton);
    if (!editBtn) {
      await stop('Could not find the Edit button for: ' + name);
      return;
    }
    setMsg('Cancelling ' + done + ' of ' + total + ': ' + name, s.cancelledCount || 0);

    // A click that lands before the page's handlers attach is ignored, so retry once.
    editBtn.click();
    let cancelLink = await waitForElement(S.cancelMenuItem, 5000);
    if (aborted) return;
    if (!cancelLink) {
      editBtn.click();
      cancelLink = await waitForElement(S.cancelMenuItem, 10000);
    }
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
      queue: queue.slice(1),
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
    setButtonMode('stop');

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

  // The popup asks for the list of subscriptions to build its checklist.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'snsScan') return;
    if (!onListPage()) {
      sendResponse({ ok: false, reason: 'not-list' });
      return;
    }
    scanTiles().then((items) => sendResponse({ ok: true, items }));
    return true; // async response
  });

  // Honor Stop pressed in the popup or another tab.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    const nv = changes[KEY].newValue || {};
    if (nv.running === false) {
      aborted = true;
      if (overlayEl) {
        setMsg(nv.lastMessage || 'Stopped.', nv.cancelledCount || 0);
        setButtonMode('close');
      }
    }
  });

  main();
})();
