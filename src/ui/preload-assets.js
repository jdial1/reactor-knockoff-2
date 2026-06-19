const IMG_BASE = `${import.meta.env.BASE_URL}img/`;

const GAME_ICON_NAMES = [
  'accelerator_1.webp', 'accelerator_2.webp', 'accelerator_3.webp', 'accelerator_4.webp', 'accelerator_5.webp', 'accelerator_6.webp',
  'capacitor_1.webp', 'capacitor_2.webp', 'capacitor_3.webp', 'capacitor_4.webp', 'capacitor_5.webp', 'capacitor_6.webp',
  'cell_1_1.webp', 'cell_1_2.webp', 'cell_1_4.webp', 'cell_2_1.webp', 'cell_2_2.webp', 'cell_2_4.webp',
  'cell_3_1.webp', 'cell_3_2.webp', 'cell_3_4.webp', 'cell_4_1.webp', 'cell_4_2.webp', 'cell_4_4.webp',
  'cell_5_1.webp', 'cell_5_2.webp', 'cell_5_4.webp', 'cell_6_1.webp', 'cell_6_2.webp', 'cell_6_4.webp',
  'coolant_1.webp', 'coolant_2.webp', 'coolant_3.webp', 'coolant_4.webp', 'coolant_5.webp', 'coolant_6.webp',
  'exchanger_1.webp', 'exchanger_2.webp', 'exchanger_3.webp', 'exchanger_4.webp', 'exchanger_5.webp', 'exchanger_6.webp',
  'inlet_1.webp', 'inlet_2.webp', 'inlet_3.webp', 'inlet_4.webp', 'inlet_5.webp', 'inlet_6.webp',
  'outlet_1.webp', 'outlet_2.webp', 'outlet_3.webp', 'outlet_4.webp', 'outlet_5.webp', 'outlet_6.webp',
  'plating_1.webp', 'plating_2.webp', 'plating_3.webp', 'plating_4.webp', 'plating_5.webp', 'plating_6.webp',
  'reflector_1.webp', 'reflector_2.webp', 'reflector_3.webp', 'reflector_4.webp', 'reflector_5.webp', 'reflector_6.webp',
  'vent_1.webp', 'vent_2.webp', 'vent_3.webp', 'vent_4.webp', 'vent_5.webp', 'vent_6.webp',
  'xcell_1_1.webp', 'xcell_1_2.webp', 'xcell_1_4.webp',
  'upgrade_cols.webp', 'upgrade_computer.webp', 'upgrade_flux.webp', 'upgrade_rows.webp',
  'status_bolt.webp', 'status_infinity.webp', 'status_plus.webp', 'status_star.webp', 'status_time.webp',
  'icon_cash.webp', 'icon_heat.webp', 'icon_inlet.webp', 'icon_outlet.webp', 'icon_power.webp', 'icon_vent.webp',
  'nav_experimental.webp', 'nav_normal.webp', 'nav_pause.webp', 'nav_play.webp', 'nav_renew.webp', 'nav_unrenew.webp',
  'lab.webp', 'explosion_map.webp', 'tile.webp',
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
