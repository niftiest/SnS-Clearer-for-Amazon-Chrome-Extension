const KEY = 'snsClearerState';
const LIST_URL =
  'https://www.amazon.com/auto-deliveries/subscriptionList?ref_=sns_discover_m_d_nav_mys';
const LIST_PREFIX = 'https://www.amazon.com/auto-deliveries/subscriptionList';

const $ = (id) => document.getElementById(id);
let items = []; // [{id, name, img}] scanned from the page
let listTab = null;

async function getState() {
  const o = await chrome.storage.local.get(KEY);
  return o[KEY] || {};
}

function show(section) {
  for (const id of ['picker', 'confirm', 'elsewhere', 'loading', 'progress']) {
    $(id).style.display = id === section ? 'block' : 'none';
  }
}

function showError(msg) {
  const err = $('error');
  err.textContent = msg || '';
  err.style.display = msg ? 'block' : 'none';
}

// ---------- progress view (running, or the summary after a run) ----------
function renderProgress(s) {
  const status = $('status');
  status.textContent = s.running ? 'Running' : 'Idle';
  status.className = 'val ' + (s.running ? 'status-running' : 'status-idle');
  $('count').textContent = s.cancelledCount || 0;
  $('remaining').textContent = (s.queue || []).length;
  $('last').textContent = s.lastCancelled || '—';
  $('stop').disabled = !s.running;
  showError(s.lastError);
}

// ---------- picker view ----------
const checkboxes = () => Array.from(document.querySelectorAll('#list input[type=checkbox]'));
const selectedIds = () => checkboxes().filter((c) => c.checked).map((c) => c.value);

function updateSelCount() {
  const n = selectedIds().length;
  $('selCount').textContent = n + ' of ' + items.length + ' selected';
  $('start').disabled = n === 0;
  $('start').textContent = n ? 'Cancel ' + n + ' selected' : 'Cancel selected';
}

// One row: [checkbox?] photo title. Rows in the confirm step have no checkbox.
function itemRow(it, withCheckbox) {
  const row = document.createElement(withCheckbox ? 'label' : 'div');
  row.className = 'item';
  row.title = it.name;

  if (withCheckbox) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = it.id;
    cb.addEventListener('change', updateSelCount);
    row.appendChild(cb);
  }

  const img = document.createElement('img');
  img.alt = '';
  if (it.img) img.src = it.img;

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = it.name;

  row.append(img, name);
  return row;
}

function renderList() {
  const list = $('list');
  list.textContent = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.style.padding = '10px';
    empty.textContent = 'No subscriptions found on this page.';
    list.appendChild(empty);
  }
  for (const it of items) list.appendChild(itemRow(it, true));
  updateSelCount();
}

function renderConfirm(ids) {
  const n = ids.length;
  const plural = n === 1 ? '' : 's';
  $('confirmTitle').textContent = 'Cancel ' + n + ' subscription' + plural + '?';
  $('go').textContent = 'Yes, cancel ' + n;
  const list = $('confirmList');
  list.textContent = '';
  for (const it of items) if (ids.includes(it.id)) list.appendChild(itemRow(it, false));
  showError(null);
  show('confirm');
}

async function loadPicker() {
  show('loading');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith(LIST_PREFIX)) {
    show('elsewhere');
    return;
  }
  listTab = tab;
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: 'snsScan' });
  } catch (e) {
    // Content script isn't in this tab yet (page opened before the extension loaded).
    show('elsewhere');
    $('open').textContent = 'Reload page';
    showError('Reload the subscription page, then click the extension icon again.');
    return;
  }
  if (!res || !res.ok) {
    show('elsewhere');
    return;
  }
  items = res.items;
  renderList();
  show('picker');
}

async function init() {
  const s = await getState();
  if (s.running) {
    renderProgress(s);
    show('progress');
    return;
  }
  // Surface how the last run ended (error or summary) above the picker.
  if (s.lastError) showError(s.lastError);
  await loadPicker();
}

$('all').addEventListener('click', () => {
  checkboxes().forEach((c) => (c.checked = true));
  updateSelCount();
});
$('none').addEventListener('click', () => {
  checkboxes().forEach((c) => (c.checked = false));
  updateSelCount();
});

$('open').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.startsWith(LIST_PREFIX)) await chrome.tabs.reload(tab.id);
  else await chrome.tabs.create({ url: LIST_URL, active: true });
  window.close();
});

$('start').addEventListener('click', () => {
  const ids = selectedIds();
  if (ids.length && listTab) renderConfirm(ids);
});

// Checkbox state survives in the picker DOM, so going back keeps the selection.
$('back').addEventListener('click', () => show('picker'));

$('go').addEventListener('click', async () => {
  const ids = selectedIds();
  if (!ids.length || !listTab) return;
  $('go').disabled = true;
  const names = {};
  for (const it of items) if (ids.includes(it.id)) names[it.id] = it.name;

  await chrome.storage.local.set({
    [KEY]: {
      running: true,
      queue: ids,
      total: ids.length,
      names,
      skipped: [],
      cancelledCount: 0,
      iterations: 0,
      lastError: null,
      lastCancelled: null,
      lastMessage: 'Started.',
      startedAt: Date.now()
    }
  });
  // Reload so the content script picks up the run on a fresh page.
  await chrome.tabs.reload(listTab.id);
  window.close();
});

$('stop').addEventListener('click', async () => {
  const s = await getState();
  await chrome.storage.local.set({
    [KEY]: Object.assign({}, s, { running: false, lastMessage: 'Stopped by user.' })
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[KEY]) return;
  const s = changes[KEY].newValue || {};
  if (s.running || $('progress').style.display === 'block') {
    renderProgress(s);
    show('progress');
  }
});

init();
