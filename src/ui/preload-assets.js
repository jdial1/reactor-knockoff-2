const IMG_BASE = `${import.meta.env.BASE_URL}img/`;

const GAME_ICON_NAMES = [
  'parts/accelerator_1.webp', 'parts/accelerator_2.webp', 'parts/accelerator_3.webp', 'parts/accelerator_4.webp', 'parts/accelerator_5.webp', 'parts/accelerator_6.webp',
  'parts/capacitor_1.webp', 'parts/capacitor_2.webp', 'parts/capacitor_3.webp', 'parts/capacitor_4.webp', 'parts/capacitor_5.webp', 'parts/capacitor_6.webp',
  'parts/cell_1_1.webp', 'parts/cell_1_2.webp', 'parts/cell_1_4.webp', 'parts/cell_2_1.webp', 'parts/cell_2_2.webp', 'parts/cell_2_4.webp',
  'parts/cell_3_1.webp', 'parts/cell_3_2.webp', 'parts/cell_3_4.webp', 'parts/cell_4_1.webp', 'parts/cell_4_2.webp', 'parts/cell_4_4.webp',
  'parts/cell_5_1.webp', 'parts/cell_5_2.webp', 'parts/cell_5_4.webp', 'parts/cell_6_1.webp', 'parts/cell_6_2.webp', 'parts/cell_6_4.webp',
  'parts/coolant_1.webp', 'parts/coolant_2.webp', 'parts/coolant_3.webp', 'parts/coolant_4.webp', 'parts/coolant_5.webp', 'parts/coolant_6.webp',
  'parts/exchanger_1.webp', 'parts/exchanger_2.webp', 'parts/exchanger_3.webp', 'parts/exchanger_4.webp', 'parts/exchanger_5.webp', 'parts/exchanger_6.webp',
  'parts/inlet_1.webp', 'parts/inlet_2.webp', 'parts/inlet_3.webp', 'parts/inlet_4.webp', 'parts/inlet_5.webp', 'parts/inlet_6.webp',
  'parts/outlet_1.webp', 'parts/outlet_2.webp', 'parts/outlet_3.webp', 'parts/outlet_4.webp', 'parts/outlet_5.webp', 'parts/outlet_6.webp',
  'parts/plating_1.webp', 'parts/plating_2.webp', 'parts/plating_3.webp', 'parts/plating_4.webp', 'parts/plating_5.webp', 'parts/plating_6.webp',
  'parts/reflector_1.webp', 'parts/reflector_2.webp', 'parts/reflector_3.webp', 'parts/reflector_4.webp', 'parts/reflector_5.webp', 'parts/reflector_6.webp',
  'parts/vent_1.webp', 'parts/vent_2.webp', 'parts/vent_3.webp', 'parts/vent_4.webp', 'parts/vent_5.webp', 'parts/vent_6.webp',
  'parts/xcell_1_1.webp', 'parts/xcell_1_2.webp', 'parts/xcell_1_4.webp',
  'ui/upgrades/upgrade_cols.webp', 'ui/upgrades/upgrade_computer.webp', 'ui/upgrades/upgrade_flux.webp', 'ui/upgrades/upgrade_rows.webp',
  'ui/status/status_bolt.webp', 'ui/status/status_infinity.webp', 'ui/status/status_plus.webp', 'ui/status/status_star.webp', 'ui/status/status_time.webp',
  'ui/icons/icon_cash.webp', 'ui/icons/icon_heat.webp', 'ui/icons/icon_inlet.webp', 'ui/icons/icon_outlet.webp', 'ui/icons/icon_power.webp', 'ui/icons/icon_vent.webp',
  'ui/nav/nav_experimental.webp', 'ui/nav/nav_normal.webp', 'ui/nav/nav_pause.webp', 'ui/nav/nav_play.webp', 'ui/nav/nav_renew.webp', 'ui/nav/nav_unrenew.webp',
  'parts/lab.webp', 'fx/explosion_map.webp', 'grid/tile.webp',
];

function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to preload ${url}`));
    img.src = url;
  });
}

export function preloadGameIcons() {
  return Promise.allSettled(
    GAME_ICON_NAMES.map((name) => decodeImage(`${IMG_BASE}${name}`))
  );
}
