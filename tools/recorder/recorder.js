/*
 * Amazon Subscribe & Save — flow recorder.
 *
 * Opens your real Chrome (persistent profile, so your login sticks) to the
 * subscription list page and logs everything needed to build the extension:
 *   - every click: visible text, tag, attributes, a CSS path, ancestor chain,
 *     and the element's full outerHTML (saved to its own file)
 *   - every page navigation / URL change
 *   - a full HTML snapshot of every page you land on
 *
 * Usage:  node recorder.js
 * Then: log in if asked, go through Edit > Cancel Subscription > confirm for
 * one (or a few) items end-to-end, and CLOSE the browser window when done.
 *
 * All output lands in ./logs/.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const LIST_URL =
  'https://www.amazon.com/auto-deliveries/subscriptionList?ref_=sns_discover_m_d_nav_mys';

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, 'logs');
const CLICK_HTML_DIR = path.join(LOG_DIR, 'clicks');
const SNAP_DIR = path.join(LOG_DIR, 'snapshots');
const USER_DATA = path.join(ROOT, '.pw-user-data');

for (const d of [LOG_DIR, CLICK_HTML_DIR, SNAP_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

const timelinePath = path.join(LOG_DIR, 'timeline.log');
const clicksPath = path.join(LOG_DIR, 'clicks.log');
const navPath = path.join(LOG_DIR, 'navigations.log');

function ts() {
  return new Date().toISOString();
}

function logTimeline(msg) {
  const line = `[${ts()}] ${msg}\n`;
  fs.appendFileSync(timelinePath, line);
  process.stdout.write(line);
}

function slug(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 80);
}

let clickCounter = 0;
let snapCounter = 0;

/* Injected into every page/frame before its own scripts run. Installs a
 * capturing-phase click listener that reports element details back to Node
 * via the exposed window.__record binding. */
const INIT_SCRIPT = `
(() => {
  if (window.__recorderInstalled) return;
  window.__recorderInstalled = true;

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 10) {
      let sel = el.nodeName.toLowerCase();
      if (el.id) { parts.unshift(sel + '#' + CSS.escape(el.id)); break; }
      let nth = 1, sib = el;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName === el.nodeName) nth++;
      }
      parts.unshift(sel + ':nth-of-type(' + nth + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function attrs(el) {
    const o = {};
    for (const a of el.attributes) o[a.name] = a.value;
    return o;
  }

  function report(el, eventType) {
    try {
      const chain = [];
      let anc = el;
      while (anc && chain.length < 6) {
        chain.push({
          tag: anc.nodeName.toLowerCase(),
          id: anc.id || null,
          cls: anc.className && anc.className.toString
            ? anc.className.toString().slice(0, 160) : null,
          dataAttrs: Object.fromEntries(
            [...anc.attributes].filter(a => a.name.startsWith('data-'))
              .map(a => [a.name, a.value])
          )
        });
        anc = anc.parentElement;
      }
      window.__record(JSON.stringify({
        eventType,
        url: location.href,
        tag: el.nodeName.toLowerCase(),
        text: (el.innerText || el.value || '').trim().slice(0, 200),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        attrs: attrs(el),
        cssPath: cssPath(el),
        ancestors: chain,
        outerHTML: el.outerHTML
      }));
    } catch (e) {
      window.__record(JSON.stringify({ error: String(e), eventType }));
    }
  }

  document.addEventListener('click', (e) => {
    const target = e.target;
    report(target, 'click-target');
    const interactive = target.closest &&
      target.closest('a,button,[role=button],input,[onclick],[type=submit]');
    if (interactive && interactive !== target) {
      report(interactive, 'click-interactive');
    }
  }, true);
})();
`;

function handleRecord(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    data = { raw: json };
  }
  if (data.error) {
    logTimeline('record error: ' + data.error);
    return;
  }
  clickCounter++;
  const htmlFile = path.join(
    CLICK_HTML_DIR,
    String(clickCounter).padStart(3, '0') + '-' + data.eventType + '.html'
  );
  fs.writeFileSync(htmlFile, data.outerHTML || '');

  const summary = [
    `=== CLICK #${clickCounter} (${data.eventType}) @ ${ts()} ===`,
    `URL: ${data.url}`,
    `tag: ${data.tag}`,
    `text: ${JSON.stringify(data.text)}`,
    `role: ${data.role}   aria-label: ${data.ariaLabel}`,
    `cssPath: ${data.cssPath}`,
    `attrs: ${JSON.stringify(data.attrs)}`,
    `ancestors: ${JSON.stringify(data.ancestors, null, 0)}`,
    `outerHTML saved -> ${path.relative(ROOT, htmlFile)}`,
    ''
  ].join('\n');
  fs.appendFileSync(clicksPath, summary + '\n');
  logTimeline(
    `CLICK #${clickCounter} [${data.eventType}] <${data.tag}> "${(data.text || '').slice(0, 50)}"`
  );
}

function attachPage(page) {
  page.on('load', async () => {
    try {
      const url = page.url();
      snapCounter++;
      const file = path.join(
        SNAP_DIR,
        String(snapCounter).padStart(3, '0') + '-' + slug(url) + '.html'
      );
      const html = await page.content();
      fs.writeFileSync(file, html);
      fs.appendFileSync(
        navPath,
        `[${ts()}] LOAD ${url}\n  snapshot -> ${path.relative(ROOT, file)}\n`
      );
      logTimeline(`LOADED ${url}  (snapshot ${path.basename(file)})`);
    } catch (e) {
      logTimeline('snapshot error: ' + e.message);
    }
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      fs.appendFileSync(navPath, `[${ts()}] NAV ${frame.url()}\n`);
      logTimeline('NAV ' + frame.url());
    }
  });
}

async function launch() {
  const attempts = [
    { label: 'Google Chrome', opts: { channel: 'chrome' } },
    { label: 'Microsoft Edge', opts: { channel: 'msedge' } },
    { label: 'bundled Chromium', opts: {} }
  ];
  for (const a of attempts) {
    try {
      logTimeline('Launching ' + a.label + ' ...');
      return await chromium.launchPersistentContext(USER_DATA, {
        headless: false,
        viewport: null,
        args: ['--start-maximized'],
        ...a.opts
      });
    } catch (e) {
      logTimeline(`launch failed (${a.label}): ${e.message}`);
    }
  }
  throw new Error('Could not launch any browser (Chrome/Edge/Chromium).');
}

async function main() {
  fs.appendFileSync(timelinePath, `\n\n========== NEW SESSION ${ts()} ==========\n`);
  const context = await launch();

  await context.exposeFunction('__record', handleRecord);
  await context.addInitScript(INIT_SCRIPT);

  context.on('page', attachPage);
  const page = context.pages()[0] || (await context.newPage());
  attachPage(page);

  logTimeline('Navigating to subscription list ...');
  await page
    .goto(LIST_URL, { waitUntil: 'domcontentloaded' })
    .catch((e) => logTimeline('goto error: ' + e.message));

  logTimeline(
    'READY >>> Log in if prompted, then go through Edit > Cancel Subscription > ' +
      'confirm for one (or a few) items END TO END. CLOSE the browser window when done.'
  );

  context.on('close', () => {
    logTimeline('Browser closed. Recording stopped. Logs are in ./logs/');
    process.exit(0);
  });
}

main().catch((e) => {
  logTimeline('FATAL ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
