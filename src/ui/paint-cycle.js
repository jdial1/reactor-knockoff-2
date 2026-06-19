import { mergeTickResults } from '../engine/tick-result.js';
import { tileByIndex } from '../engine/tile-index.js';
import { removePartDom } from '../engine/placement.js';
import { haptic } from './haptics.js';

const BAR_STEPS = Math.round(100 / 28);

export function roundBarPercentage(perc, step = 1) {
  return Math.round((perc * 100) / step) * step;
}

export function createPaintCycle(deps) {
  let paintScheduled = false;
  let pending = null;
  let tileElMap = new Map();

  function registerTile(index, el) {
    tileElMap.set(index, el);
  }

  function ingestTickResult(result) {
    if (!result) return;

    if (Array.isArray(result.tileDiffs)) {
      const map = new Map();
      for (const diff of result.tileDiffs) {
        map.set(diff.index, diff);
      }
      result.tileDiffs = map;
    }

    if (!pending) {
      pending = {
        stats: {},
        tileDiffs: new Map(),
        visualEvents: [],
        flags: {
          rebuildTopology: false,
          meltdown: false,
          save: false,
          meltingDown: null,
        },
      };
    }

    mergeTickResults(pending, result);

    if (
      Object.keys(pending.stats).length ||
      pending.tileDiffs.size ||
      pending.visualEvents.length ||
      pending.flags.save ||
      pending.flags.meltingDown !== null
    ) {
      schedulePaint();
    }
  }

  function schedulePaint() {
    if (paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(flushPaint);
  }

  function setCoreHeatOpacity(currentHeat, maxHeat) {
    const ratio =
      currentHeat <= maxHeat ? 0 : Math.min(1, (currentHeat - maxHeat) / maxHeat);
    document.documentElement.style.setProperty('--core-heat-opacity', String(ratio));
  }

  function applyStats(stats) {
    for (const [name, value] of Object.entries(stats)) {
      deps.ui.say('var', name, value);
    }

    const currentHeat =
      stats.current_heat !== undefined
        ? stats.current_heat
        : deps.getCurrentHeat();
    const maxHeat =
      stats.max_heat !== undefined ? stats.max_heat : deps.getMaxHeat();

    if (stats.current_heat !== undefined || stats.max_heat !== undefined) {
      setCoreHeatOpacity(currentHeat, maxHeat);
    }
  }

  function applyTileDiff(index, diff) {
    const tile = tileByIndex(deps.game, index);
    const el = tile?.$el || tileElMap.get(index);
    if (!tile || !el) return;

    if (diff.ticks !== undefined) {
      const prevTicks = tile.ticks;
      tile.ticks = diff.ticks;
      tile.ticksLast = diff.ticks;
      if (tile.part) {
        const width = roundBarPercentage(tile.ticks / tile.part.ticks, BAR_STEPS);
        el.setBarWidth(width);
        if (prevTicks > 0 && diff.ticks === 0) {
          haptic('deplete');
        }
      } else {
        el.setBarWidth(0);
      }
    }

    if (diff.heat_contained !== undefined) {
      tile.heat_contained = diff.heat_contained;
      tile.heat_containedLast = diff.heat_contained;
      if (tile.part && tile.part.containment) {
        const width = roundBarPercentage(
          tile.heat_contained / tile.part.containment,
          BAR_STEPS
        );
        el.setBarWidth(width);
      } else {
        el.setBarWidth(0);
      }
    }

    if (diff.activated !== undefined) {
      tile.activated = diff.activated;
    }
  }

  function applyVisualEvent(event) {
    const el = tileElMap.get(event.index) || tileByIndex(deps.game, event.index)?.$el;
    if (!el) return;

    if (event.type === 'class') {
      if ((event.add || []).includes('exploding') && el.classList.contains('exploding')) {
        return;
      }
      for (const cls of event.remove || []) {
        el.classList.remove(cls);
      }
      for (const cls of event.add || []) {
        el.classList.add(cls);
      }
    } else if (event.type === 'part_removed') {
      const tile = tileByIndex(deps.game, event.index);
      if (tile) {
        deps.removePartDom(tile);
      }
    }
  }

  function flushPaint() {
    paintScheduled = false;

    if (!pending) return;

    const batch = pending;
    pending = null;

    window.updateProperty();
    applyStats(batch.stats);

    const reactorVisible =
      document.visibilityState === 'visible' &&
      deps.reactorSection.classList.contains('showing');

    if (reactorVisible) {
      for (const diff of batch.tileDiffs.values()) {
        applyTileDiff(diff.index, diff);
      }

      for (const event of batch.visualEvents) {
        applyVisualEvent(event);
      }
    }

    if (batch.flags.meltingDown === true) {
      deps.ui.say('var', 'melting_down', true);
      haptic('meltdown');
    } else if (batch.flags.meltingDown === false) {
      deps.ui.say('var', 'melting_down', false);
    }

    if (batch.flags.save) {
      deps.save();
    }

    deps.flushAffordability();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      deps.onHidden?.();
    } else {
      deps.onVisible?.();
    }
  });

  return {
    ingestTickResult,
    schedulePaint,
    registerTile,
    flushPaint,
    setCoreHeatOpacity,
  };
}
