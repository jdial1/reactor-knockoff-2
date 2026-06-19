import fs from 'fs';

const lines = fs.readFileSync('src/game/init.js', 'utf8').split(/\r?\n/);
const loopBody = lines.slice(1467, 2073).join('\n');

function toDeps(code) {
  return code
    .replace(/\bcurrent_power\b/g, '_deps.current_power')
    .replace(/\bmax_heat\b/g, '_deps.max_heat')
    .replace(/\bmax_power\b/g, '_deps.max_power')
    .replace(/\bprotium_particles\b/g, '_deps.protium_particles')
    .replace(/\bstat_outlet\b/g, '_deps.stat_outlet')
    .replace(/\bstat_inlet\b/g, '_deps.stat_inlet')
    .replace(/\btile_queue\b/g, '_deps.tile_queue')
    .replace(/\bupdate_tiles\b/g, '_deps.update_tiles')
    .replace(/\bupdate_heat_and_power\b/g, '_deps.update_heat_and_power')
    .replace(/\bremove_part\(/g, '_deps.remove_part(')
    .replace(/\bsave\(/g, '_deps.save(')
    .replace(/\btooltip_update\b/g, '_deps.tooltip_update')
    .replace(/\bgame\b/g, '_deps.game')
    .replace(/\bui\b/g, '_deps.ui');
}

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

fs.writeFileSync('src/engine/loop.js', loopJs);
console.log('rewrote loop.js');
