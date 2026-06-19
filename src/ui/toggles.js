import { $ } from '../lib/globals.js';
import { setHapticsEnabled, hapticsEnabled } from './haptics.js';

const toggle_buttons = {};

export function toggle_buttons_saves() {
  const sbuttons = {};
  for (const button of Object.keys(toggle_buttons)) {
    sbuttons[button] = toggle_buttons[button].state();
  }
  return sbuttons;
}

export function toggle_buttons_loads(buttons) {
  for (const [button, state] of Object.entries(buttons)) {
    const button_obj = toggle_buttons[button];
    if (button_obj) {
      if (button_obj.load_func) {
        button_obj.load_func(state);
      } else {
        !state ? button_obj.enable() : button_obj.disable();
      }
      button_obj.update_text();
    }
  }
}

export function update_button(button) {
  return toggle_buttons[button]['update_text'];
}

export function create_toggle_button(button, enable_text, disable_text) {
  const $button = $(button);
  $button.textContent = enable_text;
  return (state, enable_callback, disable_callback, always_update_text, load_func) => {
    const update_text = () => {
      $button.textContent = !state() ? enable_text : disable_text;
      $button.dataset.led = state() ? 'off' : 'on';
    };
    toggle_buttons[button] = {
      update_text,
      state,
      enable: enable_callback,
      disable: disable_callback,
      load_func,
    };
    $button.onclick = (event) => {
      event.preventDefault();
      state() ? enable_callback() : disable_callback();
      if (always_update_text) {
        update_text();
      }
    };
  };
}

function create_switch_toggle(button, enable_text, disable_text, { invertChecked = false, led = 'normal' } = {}) {
  const input = $(button);
  const label = input?.closest('.game-switch')?.querySelector('.game-switch__label');
  const switchEl = input?.closest('.game-switch');
  const syncLed = (s) => {
    if (!switchEl) return;
    if (led === 'pause') {
      switchEl.dataset.led = s ? 'alarm' : 'on';
    } else if (invertChecked) {
      switchEl.dataset.led = s ? 'off' : 'on';
    } else {
      switchEl.dataset.led = s ? 'on' : 'off';
    }
  };
  return (state, enable_callback, disable_callback, always_update_text, load_func) => {
    let syncing = false;
    const update_text = () => {
      syncing = true;
      const s = state();
      input.checked = invertChecked ? !s : s;
      input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
      if (label) {
        label.textContent = s ? disable_text : enable_text;
      }
      syncLed(s);
      syncing = false;
    };
    toggle_buttons[button] = {
      update_text,
      state,
      enable: enable_callback,
      disable: disable_callback,
      load_func,
    };
    input.onchange = (event) => {
      event.preventDefault();
      if (syncing) return;
      state() ? enable_callback() : disable_callback();
      update_text();
    };
    if (label) {
      label.textContent = enable_text;
    }
  };
}

export function initToggles(ui, mainEl, reactorEl) {
  create_switch_toggle('#pause_toggle', 'Pause', 'Unpause', { led: 'pause' })(
    () => ui.game?.paused ?? false,
    () => window.unpause(),
    () => window.pause()
  );

  create_switch_toggle('#auto_sell_toggle', 'Disable Auto Sell', 'Enable Auto Sell', { invertChecked: true })(
    () => ui.game?.auto_sell_disabled ?? false,
    () => window.enable_auto_sell(),
    () => window.disable_auto_sell()
  );

  create_switch_toggle('#heat_control_toggle', 'Disable Heat Controller', 'Enable Heat Controller', { invertChecked: true })(
    () => !(ui.game?.heat_controlled ?? false),
    () => window.enable_heat_control(),
    () => window.disable_heat_control()
  );

  create_switch_toggle('#time_flux_toggle', 'Disable Time Flux', 'Enable Time Flux', { invertChecked: true })(
    () => !(ui.game?.time_flux ?? false),
    () => window.enable_time_flux(),
    () => window.disable_time_flux()
  );

  create_switch_toggle('#auto_buy_toggle', 'Disable Auto Buy', 'Enable Auto Buy', { invertChecked: true })(
    () => ui.game?.auto_buy_disabled ?? false,
    () => window.enable_auto_buy(),
    () => window.disable_auto_buy()
  );

  let speed_hack = false;
  create_toggle_button('#speed_hack', 'Disable Speed Hack', 'Enable Speed Hack')(
    () => !speed_hack,
    () => {
      speed_hack = true;
      mainEl.classList.add('speed_hack');
      reactorEl.classList.add('speed_hack');
    },
    () => {
      speed_hack = false;
      mainEl.classList.remove('speed_hack');
      reactorEl.classList.remove('speed_hack');
    },
    true
  );

  create_toggle_button('#offline_tick', 'Disable Offline Tick', 'Enable Offline Tick')(
    () => !(ui.game?.offline_tick ?? true),
    () => {
      ui.game.offline_tick = true;
    },
    () => {
      ui.game.offline_tick = false;
    },
    true,
    (state) => {
      ui.game.offline_tick = state || ui.game.offline_tick;
    }
  );

  create_switch_toggle('#haptics_toggle', 'Enable Haptics', 'Disable Haptics')(
    () => hapticsEnabled(),
    () => setHapticsEnabled(false),
    () => setHapticsEnabled(true),
    false,
    (state) => setHapticsEnabled(!!state)
  );

  return {
    refreshAll() {
      Object.keys(toggle_buttons).forEach((id) => toggle_buttons[id].update_text());
    },
    events: {
      paused: update_button('#pause_toggle'),
      unpaused: update_button('#pause_toggle'),
      auto_sell_disabled: update_button('#auto_sell_toggle'),
      auto_sell_enabled: update_button('#auto_sell_toggle'),
      auto_buy_disabled: update_button('#auto_buy_toggle'),
      auto_buy_enabled: update_button('#auto_buy_toggle'),
      heat_control_disabled: update_button('#heat_control_toggle'),
      heat_control_enabled: update_button('#heat_control_toggle'),
      time_flux_disabled: update_button('#time_flux_toggle'),
      time_flux_enabled: update_button('#time_flux_toggle'),
    },
  };
}
