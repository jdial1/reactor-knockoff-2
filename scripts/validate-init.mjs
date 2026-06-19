import puppeteer from 'puppeteer';

const BASE_URL = process.env.INIT_VALIDATE_URL || 'http://localhost:5173/';
const TIMEOUT = 20000;

async function validateInit(page) {
  const errors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    consoleErrors.push(err.stack || String(err));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });

  await page.waitForFunction(
    () =>
      document.querySelectorAll('#reactor reactor-tile.enabled').length > 0 &&
      typeof window.pause === 'function',
    { timeout: TIMEOUT }
  );

  const state = await page.evaluate(() => ({
    initError: window.__initError ?? null,
    hasPause: typeof window.pause === 'function',
    hasUnpause: typeof window.unpause === 'function',
    tileCount: document.querySelectorAll('#reactor reactor-tile').length,
    enabledTiles: document.querySelectorAll('#reactor reactor-tile.enabled').length,
    pauseToggle: !!document.getElementById('pause_toggle'),
    pauseLabel: document.querySelector('#pause_toggle')?.closest('.game-switch')?.querySelector('.game-switch__label')?.textContent ?? null,
    moreStatsLabel: document.getElementById('more_stats_toggle')?.textContent ?? null,
    reactorShowing: document.getElementById('main')?.classList.contains('reactor_showing'),
    money: document.getElementById('money')?.textContent,
    currentHeat: document.getElementById('current_heat')?.textContent,
    coreHeatOpacity: getComputedStyle(document.documentElement).getPropertyValue('--core-heat-opacity').trim(),
  }));

  if (state.initError) errors.push(`initGame failed: ${state.initError}`);
  if (!state.hasPause) errors.push('window.pause missing');
  if (!state.hasUnpause) errors.push('window.unpause missing');
  if (state.tileCount === 0) errors.push('no reactor-tile elements created');
  if (state.enabledTiles === 0) errors.push('no enabled reactor tiles');
  if (!state.pauseToggle) errors.push('#pause_toggle missing');
  if (!state.moreStatsLabel) errors.push('#more_stats_toggle label not initialized');

  const filteredConsoleErrors = consoleErrors.filter(
    (line) =>
      !line.includes('favicon.ico') &&
      !line.includes('Failed to load resource') &&
      !line.includes('[vite]')
  );

  return { errors, consoleErrors: filteredConsoleErrors, state };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const { errors, consoleErrors, state } = await validateInit(page);

    console.log('Init validation state:', JSON.stringify(state, null, 2));

    if (consoleErrors.length) {
      console.error('Console errors:');
      consoleErrors.forEach((line) => console.error(`  ${line}`));
    }

    if (errors.length) {
      console.error('Init validation FAILED:');
      errors.forEach((line) => console.error(`  - ${line}`));
      process.exit(1);
    }

    if (consoleErrors.length) {
      console.error('Init validation FAILED due to console errors');
      process.exit(1);
    }

    console.log('Init validation PASSED');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Init validation crashed:', err.message);
  process.exit(1);
});
