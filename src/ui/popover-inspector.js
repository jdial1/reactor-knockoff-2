const LONG_PRESS_MS = 450;
const MOVE_SLOP = 10;

let tooltip_update = null;
let inspector_showing = false;
let tooltip_task;

export function getTooltipUpdate() {
  return tooltip_update;
}

export function isInspectorShowing() {
  return inspector_showing;
}

function inspectorIsMobile() {
  return window.matchMedia('(max-width: 938px)').matches;
}

function showInspectorShell() {
  if (inspector_showing) return;
  inspector_showing = true;
  const inspector = document.getElementById('tile-inspector');
  const main = document.getElementById('main');
  main?.classList.add('inspector_showing');
  document.body.classList.add('inspector_showing');
  if (inspectorIsMobile() && inspector) {
    if (!showInspectorShell.inspectorHome) {
      showInspectorShell.inspectorHome = inspector.parentNode;
    }
    if (inspector.parentNode !== document.body) {
      document.body.appendChild(inspector);
    }
  }
}

function hideInspectorShell() {
  const inspector = document.getElementById('tile-inspector');
  const main = document.getElementById('main');
  main?.classList.remove('inspector_showing');
  document.body.classList.remove('inspector_showing');
  if (
    inspector &&
    showInspectorShell.inspectorHome &&
    inspector.parentNode !== showInspectorShell.inspectorHome
  ) {
    showInspectorShell.inspectorHome.appendChild(inspector);
  }
  inspector_showing = false;
}

function inspectorShow(part, tile, update) {
  clearTimeout(tooltip_task);
  if (!part) {
    tooltip_task = setTimeout(inspectorHide, 200);
    return;
  }

  showInspectorShell();
  part.showTooltip(tile);
  tooltip_update = update;
}

function inspectorHide() {
  clearTimeout(tooltip_task);
  tooltip_task = setTimeout(_inspectorHide, 200);
}

function _inspectorHide() {
  tooltip_update = null;
  hideInspectorShell();
}

function tileInspectorShow(e) {
  if (!this.tile?.part) return;
  inspectorShow(this.tile.part, this.tile, () => {
    if (this.tile.part) {
      this.tile.part.updateTooltip(this.tile);
    }
  });
}

function partInspectorShow(e) {
  inspectorShow(this._part, undefined, () => {
    this._part.updateTooltip();
  });
}

function findPressTarget(container, className, node) {
  let target = node;
  while (target && target !== container) {
    if (target.classList?.contains(className)) {
      return target;
    }
    target = target.parentNode;
  }
  return null;
}

function bindLongPress(container, className, onLongPress, mainEl) {
  let timer;
  let startX;
  let startY;
  let activeTarget = null;
  const longPressTargets = new WeakMap();

  const clear = () => {
    clearTimeout(timer);
    timer = null;
  };

  container.addEventListener('pointerdown', (e) => {
    if (!inspectorIsMobile() || e.pointerType === 'mouse') return;
    if (mainEl?.classList.contains('macro_mode') && mainEl?.classList.contains('part_active')) return;

    activeTarget = findPressTarget(container, className, e.target);
    if (!activeTarget) return;

    longPressTargets.set(activeTarget, false);
    startX = e.clientX;
    startY = e.clientY;
    timer = setTimeout(() => {
      longPressTargets.set(activeTarget, true);
      onLongPress.call(activeTarget, e);
    }, LONG_PRESS_MS);
  });

  container.addEventListener('pointermove', (e) => {
    if (!timer) return;
    if (
      Math.abs(e.clientX - startX) > MOVE_SLOP ||
      Math.abs(e.clientY - startY) > MOVE_SLOP
    ) {
      if (activeTarget) {
        longPressTargets.delete(activeTarget);
      }
      clear();
    }
  });

  container.addEventListener('pointerup', () => {
    if (activeTarget && longPressTargets.get(activeTarget)) {
      inspectorHide();
    }
    clear();
    activeTarget = null;
  });

  container.addEventListener('pointercancel', () => {
    if (activeTarget) {
      longPressTargets.delete(activeTarget);
    }
    clear();
    activeTarget = null;
  });

  container.addEventListener(
    'click',
    (e) => {
      const target = findPressTarget(container, className, e.target);
      if (!target || !longPressTargets.get(target)) return;
      e.preventDefault();
      e.stopPropagation();
      longPressTargets.delete(target);
    },
    true
  );
}

let syncMobilePartsDrawer;

export function initPopoverInspector({
  mainEl,
  reactorEl,
  allPartsEl,
  allUpgradesEl,
  syncMobilePartsDrawer: syncDrawer,
  Upgrade,
}) {
  syncMobilePartsDrawer = syncDrawer;

  const inspector = document.getElementById('tile-inspector');
  if (inspectorIsMobile() && inspector?.parentNode) {
    showInspectorShell.inspectorHome = inspector.parentNode;
    document.body.appendChild(inspector);
  }

  reactorEl.delegate('tile', 'mouseover', tileInspectorShow);
  reactorEl.delegate('tile', 'mouseout', inspectorHide);
  reactorEl.delegate('tile', 'focus', tileInspectorShow);
  reactorEl.delegate('tile', 'blur', inspectorHide);

  allPartsEl.delegate('part', 'mouseover', partInspectorShow);
  allPartsEl.delegate('part', 'mouseout', inspectorHide);
  allPartsEl.delegate('part', 'focus', partInspectorShow);
  allPartsEl.delegate('part', 'blur', inspectorHide);

  bindLongPress(reactorEl, 'tile', tileInspectorShow, mainEl);
  bindLongPress(allPartsEl, 'part', partInspectorShow, mainEl);

  Upgrade.prototype.showTooltip = function () {
    const $tooltip_name = document.getElementById('tooltip_name');
    const $tooltip_cost = document.getElementById('tooltip_cost');
    const $tooltip_ticks_wrapper = document.getElementById('tooltip_ticks_wrapper');
    const $tooltip_sells_wrapper = document.getElementById('tooltip_sells_wrapper');
    const $tooltip_heat_per_wrapper = document.getElementById('tooltip_heat_per_wrapper');
    const $tooltip_power_per_wrapper = document.getElementById('tooltip_power_per_wrapper');
    const $tooltip_heat_wrapper = document.getElementById('tooltip_heat_wrapper');
    const $tooltip_chance_wrapper = document.getElementById('tooltip_chance_wrapper');

    $tooltip_name.textContent = this.upgrade.title;
    $tooltip_cost.style.display = null;
    $tooltip_ticks_wrapper.style.display = 'none';
    $tooltip_sells_wrapper.style.display = 'none';
    $tooltip_heat_per_wrapper.style.display = 'none';
    $tooltip_power_per_wrapper.style.display = 'none';
    $tooltip_heat_wrapper.style.display = 'none';
    $tooltip_chance_wrapper.style.display = 'none';
    this.updateTooltip();
  };

  Upgrade.prototype.updateTooltip = function () {
    const $tooltip_description = document.getElementById('tooltip_description');
    const $tooltip_cost = document.getElementById('tooltip_cost');
    $tooltip_description.textContent = this.upgrade.description;

    if (this.ecost) {
      $tooltip_cost.textContent = this.display_cost + ' EP';
    } else {
      $tooltip_cost.textContent = this.display_cost;
    }
  };

  const upgradeInspectorShow = function () {
    inspectorShow(this.upgrade, undefined, null);
  };

  allUpgradesEl.delegate('upgrade', 'mouseover', upgradeInspectorShow);
  allUpgradesEl.delegate('upgrade', 'mouseout', inspectorHide);
  allUpgradesEl.delegate('upgrade', 'focus', upgradeInspectorShow);
  allUpgradesEl.delegate('upgrade', 'blur', inspectorHide);
  bindLongPress(allUpgradesEl, 'upgrade', upgradeInspectorShow, mainEl);

  return {
    showPartTooltip: partInspectorShow,
    hide: inspectorHide,
  };
}
