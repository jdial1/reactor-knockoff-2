import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.UI_AUDIT_URL || 'http://localhost:5173/';
const OUT_DIR = path.resolve('scripts/ui-audit-output');

const VIEWPORTS = [
  { name: 'mobile-portrait-375', width: 375, height: 667, mobile: true },
  { name: 'mobile-portrait-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-landscape-667', width: 667, height: 375, mobile: true },
  { name: 'tablet-portrait-768', width: 768, height: 1024, mobile: true },
  { name: 'breakpoint-938', width: 938, height: 800, mobile: true },
  { name: 'desktop-939', width: 939, height: 800, mobile: false },
  { name: 'desktop-1200', width: 1200, height: 800, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
];

function rect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
    bottom: Math.round(r.bottom),
    right: Math.round(r.right),
  };
}

function style(el, prop) {
  if (!el) return null;
  return getComputedStyle(el).getPropertyValue(prop);
}

async function auditViewport(page, vp) {
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('#reactor .tile.enabled', { timeout: 15000 });

  const data = await page.evaluate((mobileExpected) => {
    const pick = (id) => document.getElementById(id);
    const q = (sel) => document.querySelector(sel);

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
      };
    };

    const overlaps = (a, b) => {
      if (!a || !b) return false;
      return !(a.right <= b.x || a.x >= b.right || a.bottom <= b.y || a.y >= b.bottom);
    };

    const stats = pick('stats_section');
    const pageNav = pick('page_nav');
    const parts = pick('parts_section');
    const gameControls = pick('game_controls');
    const reactorViewport = pick('reactor_viewport');
    const secondary = pick('secondary');
    const primary = pick('primary');
    const main = pick('main');
    const moreStats = pick('more_stats');

    const statsStyle = stats ? getComputedStyle(stats) : null;
    const pageNavStyle = pageNav ? getComputedStyle(pageNav) : null;
    const partsStyle = parts ? getComputedStyle(parts) : null;
    const gameControlsStyle = gameControls ? getComputedStyle(gameControls) : null;
    const secondaryStyle = secondary ? getComputedStyle(secondary) : null;
    const mainStyle = main ? getComputedStyle(main) : null;

    const isMobile = window.matchMedia('(max-width: 938px)').matches;

    const tiles = [...document.querySelectorAll('#reactor .tile.enabled')];
    const firstTile = tiles[0];
    const tileSize = firstTile ? getComputedStyle(firstTile).width : null;

    const navButtons = pageNav ? [...pageNav.querySelectorAll('.nav')] : [];
    const activeNav = navButtons.find((b) => b.classList.contains('active'));

    const statsR = rect(stats);
    const pageNavR = rect(pageNav);
    const partsR = rect(parts);
    const gameControlsR = rect(gameControls);
    const reactorR = rect(reactorViewport);

    const issues = [];

    if (mobileExpected !== isMobile) {
      issues.push(`Media query mismatch: expected mobile=${mobileExpected}, got ${isMobile}`);
    }

    if (isMobile) {
      if (statsStyle?.position !== 'fixed') issues.push('stats_section not position:fixed on mobile');
      if (statsR && statsR.y !== 0) issues.push(`stats_section not pinned to top (y=${statsR.y})`);
      if (statsR && statsR.h > 60) issues.push(`stats_section height ${statsR.h}px exceeds 60px cap`);
      if (pageNavStyle?.position !== 'fixed') issues.push('page_nav not position:fixed on mobile');
      if (pageNavR && pageNavR.bottom !== window.innerHeight) {
        issues.push(`page_nav not flush bottom (bottom=${pageNavR.bottom}, viewport=${window.innerHeight})`);
      }
      if (partsStyle?.position !== 'fixed') issues.push('parts_section not position:fixed on mobile');
      if (partsR && pageNavR && partsR.bottom > pageNavR.y + 2) {
        issues.push(`parts_section overlaps page_nav (parts bottom=${partsR.bottom}, nav top=${pageNavR.y})`);
      }
      if (moreStats && getComputedStyle(moreStats).display === 'none') {
        issues.push('more_stats toggle hidden on mobile');
      }
      if (!activeNav) issues.push('No active tab in page_nav');
      if (reactorR && reactorR.h < 100) issues.push(`reactor_viewport too short (${reactorR.h}px)`);
      if (tileSize && parseFloat(tileSize) < 30) {
        issues.push(`Tile size ${tileSize} below 32px minimum`);
      }
    } else {
      if (secondaryStyle?.display === 'contents') {
        issues.push('secondary still display:contents on desktop');
      }
      const secR = rect(secondary);
      const priR = rect(primary);
      if (secR && priR && secR.x >= priR.x) {
        issues.push('Desktop dual-pane broken: secondary not left of primary');
      }
      if (pageNavStyle?.position === 'fixed') {
        issues.push('page_nav should not be fixed on desktop');
      }
    }

    const cols = getComputedStyle(document.documentElement).getPropertyValue('--cols').trim();
    const rows = getComputedStyle(document.documentElement).getPropertyValue('--rows').trim();
    const reactorDisplay = q('#reactor') ? getComputedStyle(q('#reactor')).display : null;

    return {
      isMobile,
      rects: {
        stats: statsR,
        pageNav: pageNavR,
        parts: partsR,
        gameControls: gameControlsR,
        reactorViewport: reactorR,
        secondary: rect(secondary),
        primary: rect(primary),
      },
      styles: {
        statsPosition: statsStyle?.position,
        pageNavPosition: pageNavStyle?.position,
        partsPosition: partsStyle?.position,
        gameControlsPosition: gameControlsStyle?.position,
        secondaryDisplay: secondaryStyle?.display,
        mainPaddingTop: mainStyle?.paddingTop,
        mainPaddingBottom: mainStyle?.paddingBottom,
        reactorDisplay,
        tileSize,
        cols,
        rows,
      },
      nav: {
        tabCount: navButtons.length,
        activeTab: activeNav?.textContent?.trim() || null,
        tabs: navButtons.map((b) => b.textContent?.trim()),
      },
      issues,
    };
  }, vp.mobile);

  const shotPath = path.join(OUT_DIR, `${vp.name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  return { viewport: vp, ...data, screenshot: shotPath };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const results = [];

  for (const vp of VIEWPORTS) {
    try {
      const result = await auditViewport(page, vp);
      results.push(result);
      console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
      console.log(`Mobile: ${result.isMobile} | Issues: ${result.issues.length}`);
      result.issues.forEach((i) => console.log(`  FAIL: ${i}`));
      if (!result.issues.length) console.log('  PASS');
      console.log(`  Stats: ${JSON.stringify(result.rects.stats)}`);
      console.log(`  PageNav: ${JSON.stringify(result.rects.pageNav)}`);
      console.log(`  Parts: ${JSON.stringify(result.rects.parts)}`);
      console.log(`  ReactorVP: ${JSON.stringify(result.rects.reactorViewport)}`);
      console.log(`  Tabs: ${result.nav.tabs.join(', ')} (active: ${result.nav.activeTab})`);
    } catch (err) {
      results.push({ viewport: vp, error: err.message });
      console.error(`ERROR ${vp.name}:`, err.message);
    }
  }

  await browser.close();

  const report = {
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      name: r.viewport?.name,
      size: r.viewport ? `${r.viewport.width}x${r.viewport.height}` : null,
      isMobile: r.isMobile,
      issues: r.issues || [],
      error: r.error,
      rects: r.rects,
      styles: r.styles,
      nav: r.nav,
      screenshot: r.screenshot,
    })),
  };

  const reportPath = path.join(OUT_DIR, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  const failCount = report.results.reduce((n, r) => n + (r.issues?.length || 0) + (r.error ? 1 : 0), 0);
  console.log(`\nReport: ${reportPath}`);
  console.log(`Total issues: ${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
