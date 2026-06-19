import fs from 'fs';

let src = fs.readFileSync('js/app.js', 'utf8');
src = src.replace(/^\(function\(\) \{\s*'use strict';\s*/m, '');
src = src.replace(/\}\)\(\);\s*$/m, '');
src = src.replace(/var ui = window\.ui;\s*window\.ui = null;/, '');
src = src.replace(/var save_manager = window\.save_manager;\s*window\.ui = null;/, '');
src = src.replace(/var save_manager = window\.save_manager;\s*window\.save_manager = null;/, '');
src = src.replace(/var parts = window\.parts;\s*window\.parts = null;/, '');
src = src.replace(/var upgrades = window\.upgrades\(game\);\s*window\.upgrades = null;/, 'var upgrades = upgradesFactory(game);');
src = src.replace(/var objectives = window\.objectives\(game\);/, 'var objectives = objectivesFactory(game);');
src = src.replace(/var hotkeys = window\.hotkeys;\s*window\.hotkeys = null;/, '');
src = src.replace(/window\.reboot = function/g, 'function reboot');
src = src.replace(/window\.manual_reduce_heat = function/g, 'function manual_reduce_heat');
src = src.replace(/window\.pause = function/g, 'function pause');
src = src.replace(/window\.unpause = function/g, 'function unpause');
src = src.replace(/window\.disable_auto_sell = function/g, 'function disable_auto_sell');
src = src.replace(/window\.enable_auto_sell = function/g, 'function enable_auto_sell');
src = src.replace(/window\.disable_auto_buy = function/g, 'function disable_auto_buy');
src = src.replace(/window\.enable_auto_buy = function/g, 'function enable_auto_buy');
src = src.replace(/window\.disable_heat_control = function/g, 'function disable_heat_control');
src = src.replace(/window\.enable_heat_control = function/g, 'function enable_heat_control');
src = src.replace(/window\.disable_time_flux = function/g, 'function disable_time_flux');
src = src.replace(/window\.enable_time_flux = function/g, 'function enable_time_flux');
src = src.replace(/window\.sell = function/g, 'function sell');
src = src.replace(/window\.check_upgrades_affordability = function/g, 'function check_upgrades_affordability');
src = src.replace(/window\.check_affordability = function/g, 'function check_affordability');
src = src.replace(/window\.Upgrade\.prototype\.showTooltip/g, 'Upgrade.prototype.showTooltip');

const header = `import { $, fmt, addProperty, updateProperty } from '../lib/globals.js';
import { Game, setDefaults } from '../engine/game.js';
import { Tile, setTileEmit, setTileMultipliers } from '../engine/tile.js';
import { get_tile_in_range, heat_exchanger6_range } from '../engine/heat-range.js';
import hotkeys from '../engine/macros.js';
import parts from '../data/parts.js';
import upgradesFactory from '../data/upgrades.js';
import objectivesFactory from '../data/objectives.js';
import { createSerialize, createLoad } from '../save/serialize.js';
import { attachPartTooltipMethods } from '../ui/part-tooltip.js';
import { Upgrade } from '../ui/upgrade.js';

export function initGame(ui, save_manager) {
`;

const footer = `
  window.reboot = reboot;
  window.manual_reduce_heat = manual_reduce_heat;
  window.pause = pause;
  window.unpause = unpause;
  window.disable_auto_sell = disable_auto_sell;
  window.enable_auto_sell = enable_auto_sell;
  window.disable_auto_buy = disable_auto_buy;
  window.enable_auto_buy = enable_auto_buy;
  window.disable_heat_control = disable_heat_control;
  window.enable_heat_control = enable_heat_control;
  window.disable_time_flux = disable_time_flux;
  window.enable_time_flux = enable_time_flux;
  window.sell = sell;
  window.check_upgrades_affordability = check_upgrades_affordability;
  window.check_affordability = check_affordability;
  window.Upgrade = Upgrade;

  return { game, save, loads, reboot };
}
`;

fs.mkdirSync('src/game', { recursive: true });
fs.writeFileSync('src/game/init.js', header + src + footer);
console.log('written init.js', fs.statSync('src/game/init.js').size);
