// Mock chrome.* APIs so popup.html can be rendered outside the extension for
// store screenshots. ?view=picker|confirm|progress picks the state shown.
(() => {
  const tile = (emoji, bg) =>
    'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" rx="6" fill="${bg}"/><text x="22" y="30" font-size="24" text-anchor="middle">${emoji}</text></svg>`);
  const items = [
    ['Sparkling Water, Lime, 12 fl oz (Pack of 24)', '🥤', '#e3f4ec'],
    ['Medium Roast Coffee Pods, 48 Count', '☕', '#f3e9df'],
    ['Paper Towels, Select-A-Size, 12 Double Rolls', '🧻', '#eef1f6'],
    ['AA Alkaline Batteries (24 Pack)', '🔋', '#fdf3d8'],
    ['Dog Food, Chicken & Rice, 30 lb Bag', '🐕', '#f6ece4'],
    ['Laundry Detergent Pacs, 81 Count', '🧺', '#e7eefb'],
    ['Organic Peanut Butter, Creamy, 16 oz', '🥜', '#f8eedb'],
    ['Multivitamin Gummies, 150 Count', '💊', '#f9e6ee']
  ].map(([name, e, bg], i) => ({ id: 'S' + i, name, img: tile(e, bg) }));
  const view = new URLSearchParams(location.search).get('view') || 'picker';
  const running = view === 'progress';
  const state = running
    ? { running: true, queue: ['S5', 'S6'], total: 4, cancelledCount: 2,
        lastCancelled: 'Paper Towels, Select-A-Size, 12 Double Rolls' }
    : {};
  window.chrome = {
    storage: { local: { get: async () => ({ snsClearerState: state }), set: async () => {} },
               onChanged: { addListener() {} } },
    tabs: {
      query: async () => [{ id: 1, url: 'https://www.amazon.com/auto-deliveries/subscriptionList' }],
      sendMessage: async () => ({ ok: true, items }),
      reload: async () => {}, create: async () => {}
    }
  };
  if (view !== 'progress') {
    addEventListener('load', () => setTimeout(() => {
      const cbs = document.querySelectorAll('#list input');
      [1, 2, 5, 6].forEach((i) => cbs[i] && cbs[i].click());
      if (view === 'confirm') document.getElementById('start').click();
    }, 300));
  }
})();
