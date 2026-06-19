import fs from 'fs';

const lines = fs.readFileSync('src/game/init.js', 'utf8').split(/\r?\n/);

function extract(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

function toDeps(code) {
  return code
    .replace(/\bclicked_part\b/g, '_deps.clicked_part')
    .replace(/\btile_queue\b/g, '_deps.tile_queue')
    .replace(/\bupdate_tiles\b/g, '_deps.update_tiles')
    .replace(/\bupdate_heat_and_power\b/g, '_deps.update_heat_and_power')
    .replace(/\bremove_part\b/g, '_deps.remove_part')
    .replace(/\bcurrent_power\b/g, '_deps.current_power')
    .replace(/\bmax_heat\b/g, '_deps.max_heat')
    .replace(/\bmax_power\b/g, '_deps.max_power')
    .replace(/\bprotium_particles\b/g, '_deps.protium_particles')
    .replace(/\bstat_outlet\b/g, '_deps.stat_outlet')
    .replace(/\bstat_inlet\b/g, '_deps.stat_inlet')
    .replace(/\btooltip_update\b/g, '_deps.tooltip_update')
    .replace(/\bgame\b/g, '_deps.game')
    .replace(/\bui\b/g, '_deps.ui')
    .replace(/\bsave\(/g, '_deps.save(');
}

const placementBody = extract(1106, 1235);
const loopBody = extract(1454, 2073);

const placementJs = `let _deps;

export function createPlacement(deps) {
  _deps = deps;
${toDeps(placementBody)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}

  return {
    apply_to_tile,
    remove_part,
    part_replaceable,
    tile_replaceable,
    mouse_apply_to_tile,
    part_replace,
    category_replace,
  };
}
`;

const loopJs = `let _deps;

export function createLoop(deps) {
  _deps = deps;
${toDeps(loopBody)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}

  return {
    game_loop,
    get loop_timeout() { return loop_timeout; },
    set loop_timeout(v) { loop_timeout = v; },
    get last_tick_time() { return last_tick_time; },
    set last_tick_time(v) { last_tick_time = v; },
    game_stat_prediction,
  };
}
`;

fs.writeFileSync('src/engine/placement.js', placementJs);
fs.writeFileSync('src/engine/loop.js', loopJs);
console.log('wrote placement.js', placementJs.length, 'loop.js', loopJs.length);
