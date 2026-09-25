import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Finds a local Chrome/Chromium for the browser checks on macOS, Linux CI
// runners, and Playwright-provisioned environments. Returns null if none exists.
export function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  const playwrightRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (playwrightRoot && existsSync(playwrightRoot)) {
    for (const entry of readdirSync(playwrightRoot)) {
      if (/^chromium-\d+$/.test(entry)) candidates.push(join(playwrightRoot, entry, 'chrome-linux', 'chrome'));
    }
  }
  return candidates.find(candidate => candidate && existsSync(candidate)) || null;
}
