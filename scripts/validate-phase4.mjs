import puppeteer from 'puppeteer';

const BASE_URL = process.env.INIT_VALIDATE_URL || 'http://localhost:5173/';
const TIMEOUT = 30000;
const TYPICAL_TICK_BUDGET = 5 * 1024;
const MELTDOWN_BURST_BUDGET = 50 * 1024;

async function waitForReady(page) {
  await page.waitForFunction(
    () =>
      typeof window.__phase4 === 'object' &&
      document.querySelectorAll('#reactor reactor-tile.enabled').length > 0,
    { timeout: TIMEOUT }
  );
}

async function validatePhase4(page) {
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
  await waitForReady(page);

  const layout = await page.evaluate(() => window.__phase4.placeCellLayout());
  if (!layout) errors.push('placeCellLayout failed — no empty enabled tile');

  await page.evaluate(() => window.pause());
  await page.evaluate(() => window.__phase4.runTimeFluxDebt(8000));
  await page.waitForFunction(
    () => {
      const m = window.__phase4.getMetrics();
      return m.tickMessages >= 20;
    },
    { timeout: 15000 }
  );

  const fluxMetrics = await page.evaluate(() => window.__phase4.getMetrics());
  const fluxState = await page.evaluate(() => ({
    heat: window.__phase4.game.current_heat,
    power: document.getElementById('current_power')?.textContent,
    fluxTime: window.__phase4.game.flux_tick_time,
  }));

  if (fluxMetrics.avgTickBytes > TYPICAL_TICK_BUDGET) {
    errors.push(
      `Time Flux avg tick payload ${fluxMetrics.avgTickBytes}B exceeds ${TYPICAL_TICK_BUDGET}B budget`
    );
  }
  if (fluxMetrics.maxTickBytes > TYPICAL_TICK_BUDGET * 2) {
    errors.push(
      `Time Flux max tick payload ${fluxMetrics.maxTickBytes}B exceeds ${TYPICAL_TICK_BUDGET * 2}B`
    );
  }
  if (fluxMetrics.tickMessages < 20) {
    errors.push(`Time Flux produced only ${fluxMetrics.tickMessages} tick messages (expected >= 20)`);
  }

  await page.evaluate(() => window.pause());
  const meltdownStarted = await page.evaluate(() => window.__phase4.triggerMeltdown());
  if (!meltdownStarted) errors.push('triggerMeltdown failed — no empty enabled tile');

  await page.waitForFunction(
    () => window.__phase4.game.has_melted_down === true,
    { timeout: 15000 }
  );

  const meltdownMetrics = await page.evaluate(() => window.__phase4.getMetrics());
  if (meltdownMetrics.saveTriggers < 1) {
    errors.push('Meltdown did not trigger save (saveTriggers < 1)');
  }
  if (meltdownMetrics.maxTickBytes > MELTDOWN_BURST_BUDGET) {
    errors.push(
      `Meltdown burst ${meltdownMetrics.maxTickBytes}B exceeds ${MELTDOWN_BURST_BUDGET}B budget`
    );
  }

  const saveRoundTrip = await page.evaluate(async () => {
    window.pause();
    const result = window.__phase4.roundTripSave();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const workerState = await window.__phase4.getWorkerState();
    return { ...result, workerReady: window.__phase4.workerBridge.ready, workerHeat: workerState.current_heat };
  });

  if (saveRoundTrip.before.money !== saveRoundTrip.after.money) {
    errors.push(
      `Save round-trip money mismatch: ${saveRoundTrip.before.money} vs ${saveRoundTrip.after.money}`
    );
  }
  if (saveRoundTrip.before.tileCount !== saveRoundTrip.after.tileCount) {
    errors.push(
      `Save round-trip tile count mismatch: ${saveRoundTrip.before.tileCount} vs ${saveRoundTrip.after.tileCount}`
    );
  }
  if (!saveRoundTrip.workerReady) {
    errors.push('Worker not ready after save/load round-trip');
  }

  const rafBudget = await page.evaluate(async () => {
    const samples = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name === 'phase4-paint') {
          samples.push(entry.duration);
        }
      }
    });
    observer.observe({ entryTypes: ['measure'] });

    window.__phase4.resetMetrics();
    window.unpause();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    window.pause();

    observer.disconnect();
    samples.sort((a, b) => a - b);
    const p95 = samples.length ? samples[Math.floor(samples.length * 0.95)] : 0;
    return { samples: samples.length, p95 };
  });

  const filteredConsoleErrors = consoleErrors.filter(
    (line) =>
      !line.includes('favicon.ico') &&
      !line.includes('Failed to load resource') &&
      !line.includes('[vite]')
  );

  return {
    errors,
    consoleErrors: filteredConsoleErrors,
    fluxMetrics,
    fluxState,
    meltdownMetrics,
    saveRoundTrip,
    rafBudget,
  };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) {
        return original(function (ts) {
          performance.mark('phase4-paint-start');
          cb(ts);
          performance.mark('phase4-paint-end');
          performance.measure('phase4-paint', 'phase4-paint-start', 'phase4-paint-end');
        });
      };
    });

    const result = await validatePhase4(page);

    console.log('Phase 4 validation results:');
    console.log('  Time Flux metrics:', JSON.stringify(result.fluxMetrics));
    console.log('  Time Flux state:', JSON.stringify(result.fluxState));
    console.log('  Meltdown metrics:', JSON.stringify(result.meltdownMetrics));
    console.log('  Save round-trip:', JSON.stringify(result.saveRoundTrip));
    console.log('  rAF budget (approx):', JSON.stringify(result.rafBudget));

    if (result.consoleErrors.length) {
      console.error('Console errors:');
      result.consoleErrors.forEach((line) => console.error(`  ${line}`));
    }

    if (result.errors.length) {
      console.error('Phase 4 validation FAILED:');
      result.errors.forEach((line) => console.error(`  - ${line}`));
      process.exit(1);
    }

    if (result.consoleErrors.length) {
      console.error('Phase 4 validation FAILED due to console errors');
      process.exit(1);
    }

    console.log('Phase 4 validation PASSED');
    console.log('');
    console.log('Manual smoke tests (mobile):');
    console.log('  1. Place a cell layout, enable Time Flux, watch catch-up in DevTools Performance');
    console.log('  2. Overheat a particle accelerator to meltdown — confirm auto-save fires');
    console.log('  3. Export/import save — confirm reactor state restores');
    console.log('  4. On phone: DevTools remote → Network message sizes + Performance frame times');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Phase 4 validation crashed:', err.message);
  process.exit(1);
});
