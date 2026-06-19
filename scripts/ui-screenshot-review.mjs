import puppeteer from 'puppeteer';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.UI_SCREENSHOT_URL || process.env.UI_AUDIT_URL || 'http://localhost:5173/';
const OUT_DIR = path.resolve('scripts/ui-screenshot-output');
const TIMEOUT = 30000;
const SETTLE_MS = 250;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
  { name: 'desktop', width: 1200, height: 800, mobile: false },
  { name: 'widescreen', width: 1920, height: 1080, mobile: false },
];

const DEFAULT_SCENE_IDS = [
  'reactor',
  'upgrades',
  'experiments',
  'options',
  'help',
  'tooltip',
  'reset-dialog',
  'heat-overlay',
];

const SCENES = [
  {
    id: 'reactor',
    label: 'Reactor',
    async setup(page) {
      await goToPage(page, 'reactor_section');
    },
  },
  {
    id: 'tooltip',
    label: 'Tooltip',
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await page.waitForSelector('#cells button.part', { timeout: TIMEOUT });
      await showInspector(page, '#cells button.part');
    },
  },
  {
    id: 'reset-dialog',
    label: 'Reset dialog',
    async setup(page) {
      await goToPage(page, 'options_section');
      await page.evaluate(() => document.getElementById('reset_game')?.click());
      await page.waitForFunction(
        () => document.getElementById('confirm_dialog')?.open === true,
        { timeout: TIMEOUT }
      );
    },
  },
  {
    id: 'heat-overlay',
    label: 'Heat overlay',
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await page.evaluate(() => {
        window.pause?.();
        const max =
          Number(document.getElementById('max_heat')?.textContent?.replace(/,/g, '')) || 1000;
        const heat = max * 1.9;
        const game = window.__phase4?.game;

        if (game?.ui) {
          game.current_heat = heat;
          game.ui.say('var', 'current_heat', heat);
          game.ui.update_interface();
          return;
        }

        const currentHeatEl = document.getElementById('current_heat');
        if (currentHeatEl) currentHeatEl.textContent = String(Math.round(heat));
        const ratio = Math.min(1, (heat - max) / max);
        document.documentElement.style.setProperty('--core-heat-opacity', String(ratio));
        document.documentElement.style.setProperty(
          '--heat-vignette',
          String(Math.min(1, Math.max(0, heat / max - 0.8) / 0.2))
        );
      });
      await page.waitForFunction(
        () =>
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--core-heat-opacity').trim()
          ) > 0.3,
        { timeout: TIMEOUT }
      );
    },
  },
  {
    id: 'reactor-stats-expanded',
    label: 'Reactor — expanded stats',
    mobileOnly: true,
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await clickIfVisible(page, '#more_stats_toggle');
      await waitForClass(page, '#main', 'show_more_stats');
    },
  },
  {
    id: 'reactor-parts-expanded',
    label: 'Reactor — expanded parts drawer',
    mobileOnly: true,
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await clickIfVisible(page, '#parts_drawer_toggle');
      await waitForClass(page, '#main', 'parts_expanded');
    },
  },
  {
    id: 'reactor-part-active',
    label: 'Reactor — part selected',
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await page.waitForSelector('#cells button.part', { timeout: TIMEOUT });
      await page.evaluate(() => document.querySelector('#cells button.part')?.click());
      await waitForClass(page, '#main', 'part_active');
    },
  },
  {
    id: 'reactor-tile-inspector',
    label: 'Reactor — tile inspector',
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await page.evaluate(() => window.pause?.());
      const placed = await page.evaluate(() => window.__phase4?.placeCellLayout?.() ?? false);
      if (!placed) throw new Error('Could not place a cell for tile inspector');
      await page.waitForSelector('#reactor reactor-tile.enabled[class*="part_"]', { timeout: TIMEOUT });
      await showInspector(page, '#reactor reactor-tile.enabled[class*="part_"]');
    },
  },
  {
    id: 'reactor-part-inspector',
    label: 'Reactor — part inspector',
    async setup(page) {
      await goToPage(page, 'reactor_section');
      await page.waitForSelector('#cells button.part', { timeout: TIMEOUT });
      await showInspector(page, '#cells button.part');
    },
  },
  {
    id: 'upgrades',
    label: 'Upgrades',
    async setup(page) {
      await goToPage(page, 'upgrades_section');
    },
  },
  {
    id: 'upgrades-inspector',
    label: 'Upgrades — item inspector',
    async setup(page) {
      await goToPage(page, 'upgrades_section');
      await page.waitForSelector('#upgrades button.upgrade', { timeout: TIMEOUT });
      await showInspector(page, '#upgrades button.upgrade');
    },
  },
  {
    id: 'experiments',
    label: 'Experiments',
    async setup(page) {
      await goToPage(page, 'experimental_upgrades_section');
    },
  },
  {
    id: 'options',
    label: 'Options',
    async setup(page) {
      await goToPage(page, 'options_section');
    },
  },
  {
    id: 'options-export-dialog',
    label: 'Options — export dialog',
    async setup(page) {
      await goToPage(page, 'options_section');
      await page.evaluate(() => document.getElementById('export_save')?.click());
      await page.waitForFunction(
        () => document.getElementById('Import_Export_dialog')?.open,
        { timeout: TIMEOUT }
      );
    },
  },
  {
    id: 'help',
    label: 'Help',
    async setup(page) {
      await goToPage(page, 'help_section');
    },
  },
  {
    id: 'about',
    label: 'About',
    async setup(page) {
      await goToPage(page, 'about_section');
    },
  },
  {
    id: 'patch-notes',
    label: 'Patch notes',
    async setup(page) {
      await goToPage(page, 'about_section');
      await page.evaluate(() =>
        document.querySelector('#about_section button[data-page="patch_section"]')?.click()
      );
      await page.waitForSelector('#patch_section.showing', { timeout: TIMEOUT });
    },
  },
];

const PAGE_NAV = {
  reactor_section: '#page_nav #show_reactor',
  upgrades_section: '#page_nav #show_upgrades',
  experimental_upgrades_section: '#page_nav #show_experiments',
  options_section: '#page_nav #options',
  help_section: '#show_help',
  about_section: '#show_about',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const viewports = [];
  const scenes = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--viewport' && args[i + 1]) {
      viewports.push(args[++i]);
    } else if (args[i] === '--scene' && args[i + 1]) {
      scenes.push(args[++i]);
    }
  }

  return {
    viewports: viewports.length
      ? VIEWPORTS.filter((vp) => viewports.includes(vp.name))
      : VIEWPORTS,
    scenes: scenes.length
      ? SCENES.filter((s) => scenes.includes(s.id))
      : SCENES.filter((s) => DEFAULT_SCENE_IDS.includes(s.id)),
  };
}

async function waitForReady(page) {
  await page.waitForFunction(
    () => document.querySelectorAll('#reactor reactor-tile.enabled').length > 0,
    { timeout: TIMEOUT }
  );
  await page.evaluate(() => window.pause?.());
}

async function resetUi(page) {
  await page.evaluate(() => {
    const main = document.getElementById('main');
    if (main) {
      main.classList.remove(
        'show_more_stats',
        'parts_expanded',
        'part_active',
        'inspector_showing',
        'modal_open'
      );
    }
    document.body.classList.remove('inspector_showing');
    document.querySelectorAll('button.part.part_active').forEach((el) => el.classList.remove('part_active'));
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  });
}

async function goToPage(page, pageId) {
  await resetUi(page);

  const alreadyShowing = await page.evaluate(
    (id) => document.getElementById(id)?.classList.contains('showing'),
    pageId
  );

  if (!alreadyShowing) {
    const navSelector = PAGE_NAV[pageId];
    const clicked = await page.evaluate((sel, id) => {
      const el = sel ? document.querySelector(sel) : document.querySelector(`[data-page="${id}"]`);
      if (!el) return false;
      el.click();
      return true;
    }, navSelector ?? null, pageId);

    if (!clicked) throw new Error(`Navigation control not found for ${pageId}`);
  }

  await page.waitForSelector(`#${pageId}.showing`, { timeout: TIMEOUT });
  await settle(page);
}

async function clickIfVisible(page, selector) {
  const visible = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  }, selector);

  if (visible) {
    await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
    await settle(page);
  }
}

async function waitForClass(page, selector, className) {
  await page.waitForFunction(
    (sel, cls) => document.querySelector(sel)?.classList.contains(cls),
    { timeout: TIMEOUT },
    selector,
    className
  );
  await settle(page);
}

async function showInspector(page, selector) {
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 938px)').matches);

  if (isMobile) {
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const down = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerType: 'touch',
        pointerId: 1,
      });
      el.dispatchEvent(down);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const up = new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerType: 'touch',
        pointerId: 1,
      });
      el.dispatchEvent(up);
    }, selector);
  } else {
    await page.hover(selector);
  }

  await page.waitForFunction(
    () =>
      document.getElementById('main')?.classList.contains('inspector_showing') ||
      document.body.classList.contains('inspector_showing'),
    { timeout: TIMEOUT }
  );
  await settle(page);
}

async function settle(page) {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

function shotFilename(viewport, scene) {
  return `${viewport.name}_${scene.id}.png`;
}

async function cleanOutputDir() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
}

function shouldSkipScene(scene, viewport) {
  if (scene.mobileOnly && !viewport.mobile) return 'desktop viewport';
  if (scene.desktopOnly && viewport.mobile) return 'mobile viewport';
  return null;
}

async function captureScene(page, viewport, scene, outDir) {
  const skipReason = shouldSkipScene(scene, viewport);
  if (skipReason) {
    return { skipped: true, reason: skipReason };
  }

  await scene.setup(page);
  const shotPath = path.join(outDir, shotFilename(viewport, scene));
  await page.screenshot({ path: shotPath, fullPage: false });
  return { skipped: false, screenshot: shotPath };
}

async function buildGallery(report) {
  const rows = report.results
    .map((entry) => {
      if (entry.error) {
        return `<tr><td>${entry.viewport}</td><td>${entry.label}</td><td colspan="2"><em>error: ${entry.error}</em></td></tr>`;
      }
      if (entry.skipped) {
        return `<tr><td>${entry.viewport}</td><td>${entry.label}</td><td colspan="2"><em>skipped (${entry.reason})</em></td></tr>`;
      }
      const rel = path.basename(entry.screenshot);
      return `<tr>
        <td>${entry.viewport}</td>
        <td>${entry.label}</td>
        <td><a href="${rel}">${entry.scene}</a></td>
        <td><a href="${rel}"><img src="${rel}" alt="${entry.viewport} — ${entry.scene}" loading="lazy"></a></td>
      </tr>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>UI Screenshot Review — ${report.timestamp}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #1a1a2e; color: #eee; }
    h1 { font-size: 1.25rem; margin-bottom: 8px; }
    p { color: #aaa; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #444; padding: 8px; vertical-align: top; }
    th { background: #2a2a4a; text-align: left; }
    img { max-width: 360px; height: auto; border: 1px solid #555; background: #000; }
    a { color: #7ec8e3; }
  </style>
</head>
<body>
  <h1>UI Screenshot Review</h1>
  <p>${report.url} — ${report.results.filter((r) => !r.skipped).length} captures, ${report.results.filter((r) => r.skipped).length} skipped</p>
  <table>
    <thead><tr><th>Viewport</th><th>Scene</th><th>File</th><th>Preview</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  await writeFile(path.join(OUT_DIR, 'index.html'), html);
}

async function main() {
  const { viewports, scenes } = parseArgs();
  await cleanOutputDir();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const results = [];

  for (const viewport of viewports) {
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await waitForReady(page);

    console.log(`\n=== ${viewport.name} (${viewport.width}x${viewport.height}) ===`);

    for (const scene of scenes) {
      try {
        const outcome = await captureScene(page, viewport, scene, OUT_DIR);
        const entry = {
          viewport: viewport.name,
          viewportSize: `${viewport.width}x${viewport.height}`,
          scene: scene.id,
          label: scene.label,
          ...outcome,
        };
        results.push(entry);

        if (outcome.skipped) {
          console.log(`  SKIP ${scene.id} (${outcome.reason})`);
        } else {
          console.log(`  OK   ${scene.id} → ${path.relative(process.cwd(), outcome.screenshot)}`);
        }
      } catch (err) {
        results.push({
          viewport: viewport.name,
          viewportSize: `${viewport.width}x${viewport.height}`,
          scene: scene.id,
          label: scene.label,
          error: err.message,
        });
        console.error(`  ERR  ${scene.id}: ${err.message}`);
        await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
        await waitForReady(page);
      }
    }
  }

  await browser.close();

  const report = {
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    viewports: viewports.map((vp) => ({ name: vp.name, width: vp.width, height: vp.height, mobile: vp.mobile })),
    scenes: scenes.map((s) => ({ id: s.id, label: s.label, mobileOnly: !!s.mobileOnly, desktopOnly: !!s.desktopOnly })),
    results,
  };

  const reportPath = path.join(OUT_DIR, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await buildGallery(report);

  const errors = results.filter((r) => r.error).length;
  const captures = results.filter((r) => !r.skipped && !r.error).length;
  console.log(`\nReport: ${reportPath}`);
  console.log(`Gallery: ${path.join(OUT_DIR, 'index.html')}`);
  console.log(`Captures: ${captures}/${viewports.length * scenes.length}, skipped: ${results.filter((r) => r.skipped).length}, errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
