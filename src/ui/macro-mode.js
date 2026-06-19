import { setMacroSkip } from '../engine/macros.js';

const MOBILE_MQ = '(max-width: 938px)';

const MACRO_ACTIONS = [
  { id: 'paint', label: 'Paint' },
  { id: 'row', label: 'Row' },
  { id: 'column', label: 'Col' },
  { id: 'checker', label: 'Check' },
  { id: 'replace', label: 'Replace' },
  { id: 'sell', label: 'Sell' },
];

let mainEl = null;
let macroModeActive = false;
let macroAction = 'paint';
let macroStride = 1;

function isMobileLayout() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function syncMacroClass() {
  if (!mainEl) return;
  mainEl.classList.toggle('macro_mode', macroModeActive && isMobileLayout());
}

function syncToggleLabel(toggle) {
  toggle.textContent = macroModeActive ? 'Macro On' : 'Macro Mode';
  toggle.setAttribute('aria-pressed', macroModeActive ? 'true' : 'false');
}

function syncActionBar(actionBar) {
  if (!actionBar) return;
  actionBar.hidden = !(macroModeActive && isMobileLayout());
  for (const btn of actionBar.querySelectorAll('[data-macro-action]')) {
    btn.classList.toggle('active', btn.dataset.macroAction === macroAction);
  }
  const strideSelect = actionBar.querySelector('#macro_stride');
  if (strideSelect) {
    strideSelect.value = String(macroStride);
  }
}

export function isMacroModeActive() {
  return macroModeActive && isMobileLayout();
}

export function getMacroAction() {
  return macroAction;
}

export function getMacroStride() {
  return macroStride;
}

export function initMacroMode(mainElement) {
  mainEl = mainElement;
  const toggle = document.getElementById('macro_mode_toggle');
  const actionBar = document.getElementById('macro_action_bar');

  if (!toggle) return { isMacroModeActive, getMacroAction, getMacroStride };

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isMobileLayout()) return;
    macroModeActive = !macroModeActive;
    syncMacroClass();
    syncToggleLabel(toggle);
    syncActionBar(actionBar);
  });

  if (actionBar) {
    actionBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-macro-action]');
      if (!btn) return;
      e.preventDefault();
      macroAction = btn.dataset.macroAction;
      syncActionBar(actionBar);
    });

    const strideSelect = actionBar.querySelector('#macro_stride');
    if (strideSelect) {
      strideSelect.addEventListener('change', () => {
        macroStride = parseInt(strideSelect.value, 10) || 1;
        setMacroSkip(macroStride);
      });
    }
  }

  window.matchMedia(MOBILE_MQ).addEventListener('change', () => {
    syncMacroClass();
    syncActionBar(actionBar);
    syncToggleLabel(toggle);
  });

  syncToggleLabel(toggle);
  syncActionBar(actionBar);

  return {
    isMacroModeActive,
    getMacroAction,
    getMacroStride,
    setMacroModeActive(value) {
      macroModeActive = !!value;
      syncMacroClass();
      syncToggleLabel(toggle);
      syncActionBar(actionBar);
    },
    setMacroAction(value) {
      macroAction = value;
      syncActionBar(actionBar);
    },
  };
}

export { MACRO_ACTIONS };
