const KEY = 'snsClearerState';
const LIST_URL =
  'https://www.amazon.com/auto-deliveries/subscriptionList?ref_=sns_discover_m_d_nav_mys';

async function getState() {
  const o = await chrome.storage.local.get(KEY);
  return o[KEY] || {};
}

function render(s) {
  s = s || {};
  const status = document.getElementById('status');
  status.textContent = s.running ? 'Running' : 'Idle';
  status.className = 'val ' + (s.running ? 'status-running' : 'status-idle');

  document.getElementById('count').textContent = s.cancelledCount || 0;
  document.getElementById('last').textContent = s.lastCancelled || '—';

  const err = document.getElementById('error');
  if (s.lastError) {
    err.textContent = s.lastError;
    err.style.display = 'block';
  } else {
    err.style.display = 'none';
  }

  document.getElementById('start').disabled = !!s.running;
  document.getElementById('stop').disabled = !s.running;
}

document.getElementById('start').addEventListener('click', async () => {
  const ok = confirm(
    'This will CANCEL ALL of your Amazon Subscribe & Save subscriptions, one ' +
      'after another, automatically.\n\nThis cannot be undone. Continue?'
  );
  if (!ok) return;

  await chrome.storage.local.set({
    [KEY]: {
      running: true,
      cancelledCount: 0,
      iterations: 0,
      lastError: null,
      lastCancelled: null,
      lastMessage: 'Started.',
      startedAt: Date.now()
    }
  });

  // Run the process in a fresh tab so the user's current tab is left alone.
  await chrome.tabs.create({ url: LIST_URL, active: true });
  window.close();
});

document.getElementById('stop').addEventListener('click', async () => {
  const s = await getState();
  await chrome.storage.local.set({
    [KEY]: Object.assign({}, s, { running: false, lastMessage: 'Stopped by user.' })
  });
  render(await getState());
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) render(changes[KEY].newValue || {});
});

getState().then(render);
