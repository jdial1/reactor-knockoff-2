import { resolveMacroAction } from '../engine/macro-resolve.js';
import { haptic } from './haptics.js';
import { isMacroModeActive, getMacroAction } from './macro-mode.js';

const MOBILE_MQ = '(max-width: 938px)';
const TWO_FINGER_TAP_SLOP = 12;

function isMobileLayout() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function gesturesActive(mainEl) {
  return (
    isMobileLayout() &&
    isMacroModeActive() &&
    mainEl.classList.contains('part_active') &&
    !mainEl.classList.contains('modal_open')
  );
}

function findTileEl(node, reactorEl) {
  let target = node;
  while (target && target !== reactorEl) {
    if (target.classList?.contains('tile')) {
      return target;
    }
    target = target.parentNode;
  }
  return null;
}

function tileAtPoint(reactorEl, clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  return el ? findTileEl(el, reactorEl) : null;
}

export function initTileGestures(deps) {
  const {
    mainEl,
    reactorEl,
    hotkeys,
    placementApi,
    update_tiles,
    getClickedPart,
  } = deps;

  let pointerActive = false;
  let dragBulk = false;
  let lastTileEl = null;
  let twoFingerStart = null;

  function applyMacroBatch(tileEl, options) {
    const { tiles, part_replacement_result } = resolveMacroAction(hotkeys, tileEl, {
      ...options,
      macroAction: options.macroAction ?? getMacroAction(),
      part_replaceable: placementApi.part_replaceable,
    });

    if (!tiles) return false;

    placementApi.beginBulkEdit();
    for (const tile of tiles) {
      placementApi.mouse_apply_to_tile.call(tile.$el, {}, true, part_replacement_result);
    }
    update_tiles();
    placementApi.endBulkEdit();
    haptic('placement');
    return true;
  }

  function applyPaintTile(tileEl, skipUpdate = false) {
    if (!getClickedPart()) return false;
    placementApi.mouse_apply_to_tile.call(tileEl, {}, skipUpdate);
    return true;
  }

  function endDragBulk() {
    if (dragBulk) {
      update_tiles();
      placementApi.endBulkEdit();
      dragBulk = false;
      haptic('placement');
    }
    pointerActive = false;
    lastTileEl = null;
  }

  reactorEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (!gesturesActive(mainEl)) return;

    const tileEl = findTileEl(e.target, reactorEl);
    if (!tileEl) return;

    if (getMacroAction() === 'paint') {
      pointerActive = true;
      dragBulk = true;
      placementApi.beginBulkEdit();
      lastTileEl = tileEl;
      applyPaintTile(tileEl, true);
      e.preventDefault();
    }
  });

  reactorEl.addEventListener('pointermove', (e) => {
    if (!pointerActive || getMacroAction() !== 'paint') return;

    const tileEl = tileAtPoint(reactorEl, e.clientX, e.clientY);
    if (!tileEl || tileEl === lastTileEl) return;

    lastTileEl = tileEl;
    applyPaintTile(tileEl, true);
    e.preventDefault();
  });

  reactorEl.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;

    if (pointerActive) {
      endDragBulk();
      return;
    }

    if (!gesturesActive(mainEl)) return;

    const tileEl = findTileEl(e.target, reactorEl);
    if (!tileEl) return;

    const action = getMacroAction();

    if (action === 'paint') return;

    if (applyMacroBatch(tileEl, {})) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  reactorEl.addEventListener('pointercancel', () => {
    endDragBulk();
  });

  reactorEl.addEventListener(
    'touchstart',
    (e) => {
      if (!gesturesActive(mainEl)) return;
      if (e.touches.length === 2) {
        twoFingerStart = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          time: Date.now(),
        };
      }
    },
    { passive: true }
  );

  reactorEl.addEventListener(
    'touchend',
    (e) => {
      if (!twoFingerStart || !gesturesActive(mainEl)) {
        twoFingerStart = null;
        return;
      }

      if (e.touches.length > 0) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - twoFingerStart.x;
      const dy = touch.clientY - twoFingerStart.y;
      const elapsed = Date.now() - twoFingerStart.time;
      twoFingerStart = null;

      if (Math.hypot(dx, dy) > TWO_FINGER_TAP_SLOP || elapsed > 400) return;

      const tileEl = tileAtPoint(reactorEl, touch.clientX, touch.clientY);
      if (!tileEl?.tile?.part) return;

      applyMacroBatch(tileEl, { macroAction: 'sell' });
      e.preventDefault();
    },
    { passive: false }
  );
}
