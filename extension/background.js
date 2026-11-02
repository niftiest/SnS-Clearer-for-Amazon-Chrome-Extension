/*
 * Opens the subscription list on the popup's behalf, then reopens the popup once the
 * page has loaded. Chrome closes a popup when a new tab takes focus, so the popup
 * can't wait for the page itself.
 */
const PENDING = 'snsOpenPopupForTab';

async function openList(msg) {
  if (msg.reloadTabId != null) {
    await chrome.storage.session.set({ [PENDING]: msg.reloadTabId });
    await chrome.tabs.reload(msg.reloadTabId);
  } else {
    const tab = await chrome.tabs.create({ url: msg.url, active: true });
    await chrome.storage.session.set({ [PENDING]: tab.id });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'snsOpenList') return;
  openList(msg).then(() => sendResponse({ ok: true }));
  return true; // async response
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const o = await chrome.storage.session.get(PENDING);
  if (o[PENDING] !== tabId) return;
  await chrome.storage.session.remove(PENDING);
  if (!tab.active) return; // the user moved on; don't pop up over something else
  try {
    await chrome.action.openPopup({ windowId: tab.windowId });
  } catch (e) {
    // Older Chrome or an unfocused window: the user can still click the icon.
  }
});
