import fs from 'fs';

let init = fs.readFileSync('src/game/init.js', 'utf8');
const lines = init.split(/\r?\n/);

function removeLineRange(startMarker, endMarker) {
  const start = lines.findIndex((l) => l.includes(startMarker));
  const end = lines.findIndex((l, i) => i > start && l.includes(endMarker));
  if (start === -1 || end === -1) {
    console.warn('range not found', startMarker, endMarker);
    return;
  }
  lines.splice(start, end - start);
}

removeLineRange('var stiles;', 'game.loads = loads;');
removeLineRange('var apply_to_tile = function', '// Pause (Decoupled)');
removeLineRange('/////////////////////////////\n// Game Loop', 'var prev_part;');

init = lines.join('\n');

if (!init.includes('createPlacement')) {
  init = init.replace(
    "import { migrateFromLocalStorage } from '../save/save-manager.js';",
    `import { createSerialize, createLoad } from '../save/serialize.js';
import { createPlacement } from '../engine/placement.js';
import { createLoop } from '../engine/loop.js';
import { migrateFromLocalStorage } from '../save/save-manager.js';`
  );
}

const runtimeBlock = `
var placementApi;
var loopApi;
var game_loop;
var loads;

function buildSimState() {
  return {
    get current_power() { return current_power; },
    set current_power(v) { current_power = v; },
    get max_heat() { return max_heat; },
    set max_heat(v) { max_heat = v; },
    get max_power() { return max_power; },
    set max_power(v) { max_power = v; },
    get total_exotic_particles() { return total_exotic_particles; },
    set total_exotic_particles(v) { total_exotic_particles = v; },
    get protium_particles() { return protium_particles; },
    set protium_particles(v) { protium_particles = v; },
    get current_objective() { return current_objective; },
    set current_objective(v) { current_objective = v; },
    get last_tick_time() { return loopApi.last_tick_time; },
    set last_tick_time(v) { loopApi.last_tick_time = v; },
    get loop_timeout() { return loopApi.loop_timeout; },
    set loop_timeout(v) { loopApi.loop_timeout = v; },
    get save_timeout() { return save_timeout; },
    set save_timeout(v) { save_timeout = v; },
    tile_queue,
  };
}

function wireRuntime() {
  placementApi = createPlacement({
    game,
    ui,
    get clicked_part() { return clicked_part; },
    set clicked_part(v) { clicked_part = v; },
    tile_queue,
    update_tiles,
    get tile_mousedown_right() { return tile_mousedown_right; },
  });

  loopApi = createLoop({
    game,
    ui,
    get current_power() { return current_power; },
    set current_power(v) { current_power = v; },
    get max_heat() { return max_heat; },
    set max_heat(v) { max_max_heat = v; },
    get max_power() { return max_power; },
    set max_power(v) { max_power = v; },
    get protium_particles() { return protium_particles; },
    set protium_particles(v) { protium_particles = v; },
    get stat_outlet() { return stat_outlet; },
    get stat_inlet() { return stat_inlet; },
    remove_part: placementApi.remove_part,
    update_tiles,
    update_heat_and_power,
    save,
    tile_queue,
    get tooltip_update() { return tooltip_update; },
  });

  game_loop = loopApi.game_loop;

  var saves = createSerialize(game, buildSimState);
  game.saves = saves;

  loads = createLoad(game, ui, buildSimState, null, {
    set_defaults,
    apply_to_tile: placementApi.apply_to_tile,
    update_nodes,
    update_tiles,
    update_heat_and_power,
    set_objective,
    save,
    game_loop: loopApi.game_loop,
  });
  game.loads = loads;
}

var apply_to_tile;
var remove_part;
var mouse_apply_to_tile;
`;

init = init.replace(
  'attachPartTooltipMethods(Part, game, fmt, () => transfer_multiplier, () => vent_multiplier, $, single_cell_description, multi_cell_description);',
  'attachPartTooltipMethods(Part, game, fmt, () => transfer_multiplier, () => vent_multiplier, $, single_cell_description, multi_cell_description);'
);

const insertAfter = init.indexOf('// Add part to tile');
init = init.slice(0, insertAfter) + runtimeBlock + '\n' + init.slice(insertAfter);

init = init.replace(
  /\bclearTimeout\(loop_timeout\)/g,
  'clearTimeout(loopApi.loop_timeout)'
);
init = init.replace(
  /\loop_timeout = setTimeout\(game_loop/g,
  'loopApi.loop_timeout = setTimeout(game_loop'
);
init = init.replace(
  /\blast_tick_time = null;/g,
  'loopApi.last_tick_time = null;'
);

init = init.replace(
  'ui.say(\'evt\', \'game_inited\');',
  `wireRuntime();
apply_to_tile = placementApi.apply_to_tile;
remove_part = placementApi.remove_part;
mouse_apply_to_tile = placementApi.mouse_apply_to_tile;

ui.say('evt', 'game_inited');`
);

init = init.replace('set max_heat(v) { max_max_heat = v; }', 'set max_heat(v) { max_heat = v; }');

init = init.replace(
  '$reactor.delegate(\'tile\', \'click\', function(e) {',
  `$reactor.delegate('tile', 'click', function(e) {`
);

init = init.replace(
  'mouse_apply_to_tile.call(this, e);',
  'placementApi.mouse_apply_to_tile.call(this, e);'
);
init = init.replace(
  'mouse_apply_to_tile.call(tile.$el, e, true, part_replacement_result);',
  'placementApi.mouse_apply_to_tile.call(tile.$el, e, true, part_replacement_result);'
);
init = init.replace(
  'mouse_apply_to_tile.call(this, e);',
  'placementApi.mouse_apply_to_tile.call(this, e);'
);

fs.writeFileSync('src/game/init.js', init);
console.log('patched init.js');
