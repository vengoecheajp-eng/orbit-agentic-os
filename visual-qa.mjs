import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const CHROME_PATH = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EVIDENCE_CATEGORIES = ['consoleErrors', 'pageErrors', 'failedRequests', 'httpErrors', 'navigationErrors'];
const DEFAULT_COLLECTOR_LIMITS = Object.freeze({ maxItemsPerCategory: 20, maxTotalCharacters: 16_000 });

function safeOrigin(value) {
  try { return new URL(value).origin; }
  catch { return null; }
}

function shortened(value, maximum = 500) {
  const text = String(value || '');
  return text.length <= maximum ? text : `${text.slice(0, Math.max(0, maximum - 1))}…`;
}

/**
 * A browser can emit unbounded console/network events. Keep evidence useful,
 * but never let an untrusted page grow Orbit's in-memory run record forever.
 */
export function createVisualQaEvidenceCollector(limits = {}) {
  const maxItemsPerCategory = Number.isSafeInteger(limits.maxItemsPerCategory) && limits.maxItemsPerCategory > 0
    ? limits.maxItemsPerCategory
    : DEFAULT_COLLECTOR_LIMITS.maxItemsPerCategory;
  const maxTotalCharacters = Number.isSafeInteger(limits.maxTotalCharacters) && limits.maxTotalCharacters > 0
    ? limits.maxTotalCharacters
    : DEFAULT_COLLECTOR_LIMITS.maxTotalCharacters;
  const values = Object.fromEntries(EVIDENCE_CATEGORIES.map(category => [category, []]));
  const overflowCounts = Object.fromEntries(EVIDENCE_CATEGORIES.map(category => [category, 0]));
  let retainedCharacters = 0;

  return {
    add(category, value) {
      if (!Object.hasOwn(values, category)) throw new TypeError(`Unknown visual QA evidence category: ${category}`);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (values[category].length >= maxItemsPerCategory || retainedCharacters + serialized.length > maxTotalCharacters) {
        overflowCounts[category] += 1;
        return false;
      }
      values[category].push(value);
      retainedCharacters += serialized.length;
      return true;
    },
    snapshot() {
      return {
        ...Object.fromEntries(EVIDENCE_CATEGORIES.map(category => [category, [...values[category]]])),
        overflowCounts: { ...overflowCounts },
        retainedCharacters,
        evidenceLimits: { maxItemsPerCategory, maxTotalCharacters }
      };
    }
  };
}

export function visualQaPasses({
  httpStatus,
  sameOrigin,
  domCheck,
  pageErrors = [],
  consoleErrors = [],
  failedRequests = [],
  httpErrors = [],
  navigationErrors = [],
  overflowCounts = {}
}) {
  return Boolean(
    httpStatus >= 200 && httpStatus < 300 &&
    sameOrigin &&
    !domCheck?.hasOverlay &&
    !domCheck?.isBlank &&
    pageErrors.length === 0 &&
    consoleErrors.length === 0 &&
    failedRequests.length === 0 &&
    httpErrors.length === 0 &&
    navigationErrors.length === 0 &&
    Object.values(overflowCounts).every(count => Number(count) === 0)
  );
}

function assertPageStayedOnPreview(page, previewOrigin, collector, stage) {
  const currentUrl = page.url();
  if (safeOrigin(currentUrl) === previewOrigin) return currentUrl;
  const message = `Top-level preview navigation left its isolated origin during ${stage}: ${shortened(currentUrl, 600)}`;
  collector.add('navigationErrors', message);
  const error = new Error(message);
  error.code = 'ORBIT_PREVIEW_ORIGIN_CHANGED';
  throw error;
}

function isRelevantFailedResponse(response) {
  const status = Number(response.status?.() || 0);
  if (status < 400 || status >= 600) return false;
  const resourceType = String(response.request?.().resourceType?.() || 'other').toLowerCase();
  // The main document is checked separately from page.goto(). These are the
  // first-party resources that can leave a rendered app partially broken.
  return ['script', 'stylesheet', 'xhr', 'fetch', 'image', 'font', 'media', 'manifest', 'other'].includes(resourceType);
}

export async function runVisualQA({
  previewUrl,
  runId,
  evidenceDir,
  launchBrowser = null,
  chromePath = CHROME_PATH,
  settleDelayMs = 1200,
  mobileDelayMs = 400,
  collectorLimits = {}
}) {
  mkdirSync(evidenceDir, { recursive: true });
  const desktopPath = join(evidenceDir, `${runId}-desktop.png`);
  const mobilePath = join(evidenceDir, `${runId}-mobile.png`);

  if (!launchBrowser && !existsSync(chromePath)) {
    return {
      status: 'skipped',
      reason: `Google Chrome was not found at ${chromePath}`
    };
  }

  let browser;
  let screenshotsCaptured = false;
  const collector = createVisualQaEvidenceCollector(collectorLimits);
  const previewOrigin = safeOrigin(previewUrl);
  if (!previewOrigin) return { status: 'failed', summary: 'Visual QA execution error: invalid preview URL.', error: 'Invalid preview URL.' };

  try {
    const launcher = launchBrowser || (options => chromium.launch(options));
    browser = await launcher({
      executablePath: chromePath,
      headless: true,
      args: ['--disable-dev-shm-usage']
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // Block cross-origin top-frame requests before they leave the machine.
    // Subresources remain observable below so first-party failures can be
    // reported, while delayed location assignments cannot turn the page into
    // evidence for an unrelated site.
    await page.route('**/*', async route => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame() && safeOrigin(request.url()) !== previewOrigin) {
        collector.add('navigationErrors', `Blocked top-level preview navigation outside its isolated origin: ${shortened(request.url(), 600)}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url?.() || page.url();
      if (safeOrigin(url) !== previewOrigin) {
        collector.add('navigationErrors', `Top-level preview navigated outside its isolated origin: ${shortened(url, 600)}`);
      }
    });

    page.on('console', message => {
      if (message.type() !== 'error') return;
      collector.add('consoleErrors', shortened(message.text(), 600));
    });

    page.on('pageerror', error => {
      collector.add('pageErrors', shortened(error?.message || error, 600));
    });

    page.on('requestfailed', request => {
      const url = request.url();
      if (safeOrigin(url) !== previewOrigin) return;
      collector.add('failedRequests', {
        url: shortened(url, 600),
        resourceType: shortened(request.resourceType?.() || 'unknown', 80),
        error: shortened(request.failure?.()?.errorText || 'Unknown request failure', 300)
      });
    });

    page.on('response', response => {
      const url = response.url();
      if (safeOrigin(url) !== previewOrigin || !isRelevantFailedResponse(response)) return;
      collector.add('httpErrors', {
        status: response.status(),
        resourceType: shortened(response.request?.().resourceType?.() || 'unknown', 80),
        url: shortened(url, 600)
      });
    });

    const response = await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    const httpStatus = response?.status() || 0;
    if (httpStatus < 200 || httpStatus >= 300) throw new Error(`Preview returned HTTP ${httpStatus || 'unknown'} instead of a successful page.`);
    assertPageStayedOnPreview(page, previewOrigin, collector, 'initial navigation');

    // Allow brief time for React / Vue hydration, then recheck the top frame
    // immediately before touching the DOM. A delayed redirect must not turn a
    // different origin into trusted visual evidence.
    await page.waitForTimeout(settleDelayMs);
    assertPageStayedOnPreview(page, previewOrigin, collector, 'DOM inspection');

    const domCheck = await page.evaluate(() => {
      const body = document.body;
      const text = body ? (body.innerText || '').trim() : '';
      const hasOverlay = Boolean(document.querySelector('vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay'));
      const root = document.querySelector('#root, #app, main, [data-reactroot]');
      const rootMissingOrEmpty = !root || (root.children.length === 0 && root.innerText.trim().length === 0);
      const hasVisualElements = Boolean(document.querySelector('canvas, svg, img, button, a, h1, h2, p'));
      const isBlank = text.length < 15 && !hasVisualElements && rootMissingOrEmpty;

      return {
        textSnippet: text.slice(0, 200),
        hasOverlay,
        isBlank
      };
    });
    assertPageStayedOnPreview(page, previewOrigin, collector, 'post-DOM inspection');

    await page.screenshot({ path: desktopPath, fullPage: false });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(mobileDelayMs);
    // Recheck after the mobile settle delay as responsive code can itself
    // navigate or reload the top frame.
    const finalUrl = assertPageStayedOnPreview(page, previewOrigin, collector, 'mobile capture');
    await page.screenshot({ path: mobilePath, fullPage: false });
    screenshotsCaptured = true;

    const evidence = collector.snapshot();
    const sameOrigin = safeOrigin(finalUrl) === previewOrigin && evidence.navigationErrors.length === 0;
    const passed = visualQaPasses({ httpStatus, sameOrigin, domCheck, ...evidence });

    return {
      status: passed ? 'passed' : 'failed',
      blankScreen: domCheck.isBlank,
      errorOverlay: domCheck.hasOverlay,
      httpStatus,
      finalUrl,
      sameOrigin,
      ...evidence,
      desktopScreenshot: `/api/runs/${runId}/evidence/desktop`,
      mobileScreenshot: `/api/runs/${runId}/evidence/mobile`,
      hasScreenshots: true,
      timestamp: new Date().toISOString(),
      summary: passed
        ? 'Visual QA verified: successful same-origin page, no blank screen, console errors, failed first-party requests, HTTP resource errors, or uncaught runtime exceptions.'
        : domCheck.hasOverlay
          ? 'Visual QA caught error overlay in UI.'
          : domCheck.isBlank
            ? 'Visual QA detected blank screen (empty root container).'
            : `Visual QA caught ${evidence.pageErrors.length} runtime error(s), ${evidence.consoleErrors.length} console error(s), ${evidence.failedRequests.length} failed request(s), ${evidence.httpErrors.length} first-party HTTP error(s), ${evidence.navigationErrors.length} unsafe navigation(s), and ${Object.values(evidence.overflowCounts).reduce((total, count) => total + count, 0)} additional bounded event(s).`
    };
  } catch (error) {
    if (!screenshotsCaptured) {
      for (const path of [desktopPath, mobilePath]) {
        try { unlinkSync(path); } catch { /* An incomplete evidence file may not exist. */ }
      }
    }
    return {
      status: 'failed',
      error: error.message,
      ...collector.snapshot(),
      hasScreenshots: false,
      summary: `Visual QA execution error: ${error.message}`
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
