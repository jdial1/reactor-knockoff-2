import { bootstrapSimGame, createSimRuntime, applySaveToSimGame, serializeSimState } from '../engine/sim-bootstrap.js';
import { createLoop } from '../engine/loop.js';
import { rebuildTopology } from '../engine/sim-topology.js';
import { createTickResult, setStat, mergeTickResults } from '../engine/tick-result.js';

let game;
let runtime;
let loopApi;
let tileQueue = [];
let seq = 0;
let pendingTick = null;
let tickFlushQueued = false;

function flushTickBatch() {
  tickFlushQueued = false;
  if (!pendingTick) return;

  const batch = pendingTick;
  pendingTick = null;
  const payload = {
    stats: batch.stats,
    tileDiffs: [...batch.tileDiffs.values()],
    visualEvents: batch.visualEvents,
    flags: batch.flags,
    seq: ++seq,
  };
  self.postMessage({ type: 'tick', payload });
}

function postTick(result) {
  if (!pendingTick) {
    pendingTick = createTickResult();
  }
  mergeTickResults(pendingTick, result);

  if (!tickFlushQueued) {
    tickFlushQueued = true;
    queueMicrotask(flushTickBatch);
  }
}

function wireLoop() {
  loopApi = createLoop({
    game,
    runtime,
    tile_queue: tileQueue,
    tooltip_update: null,
    onTickResult: postTick,
    save: () => self.postMessage({ type: 'meltdown' }),
  });
}

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    game = bootstrapSimGame();
    runtime = createSimRuntime(msg.payload?.runtime || {});
    tileQueue.length = 0;

    if (msg.payload?.save) {
      try {
        const save =
          typeof msg.payload.save === 'string'
            ? JSON.parse(atob(msg.payload.save))
            : msg.payload.save;
        applySaveToSimGame(game, runtime, save, game.part_objects);

        if (msg.payload.tile_queue) {
          for (const entry of msg.payload.tile_queue) {
            const tile = game.tiles[entry.row][entry.col];
            tileQueue.push(tile);
          }
        }
      } catch {
        /* empty save */
      }
    }

    rebuildTopology(game, runtime);
    wireLoop();

    if (!game.paused) {
      loopApi.game_loop();
    }

    self.postMessage({ type: 'ready', id: msg.id });
    return;
  }

  if (msg.type === 'command') {
    handleCommand(msg);
    if (msg.id !== undefined) {
      self.postMessage({ type: 'ack', id: msg.id });
    }
  }
};

function handleCommand(msg) {
  if (!game) return;

  switch (msg.cmd) {
    case 'pause':
      game.paused = true;
      if (loopApi) {
        clearTimeout(loopApi.loop_timeout);
        loopApi.last_tick_time = null;
      }
      break;

    case 'unpause':
      game.paused = false;
      if (loopApi) {
        clearTimeout(loopApi.loop_timeout);
        loopApi.game_loop();
      }
      break;

    case 'set_time_flux':
      game.time_flux = msg.value;
      break;

    case 'manual_heat_reduce':
      if (game.current_heat) {
        game.current_heat -= game.manual_heat_reduce;
        if (game.current_heat < 0) game.current_heat = 0;
        const result = createTickResult();
        setStat(result, 'current_heat', game.current_heat);
        postTick(result);
      }
      break;

    case 'sync_flags':
      Object.assign(game, msg.flags);
      break;

    case 'upgrade_level':
      if (game.upgrade_objects[msg.id]) {
        game.upgrade_objects[msg.id].setLevel(msg.level);
        rebuildTopology(game, runtime);
        const result = createTickResult();
        result.flags.rebuildTopology = true;
        Object.assign(result.stats, rebuildTopology(game, runtime));
        postTick(result);
      }
      break;

    case 'sync_state': {
      if (msg.state) {
        game.current_heat = msg.state.current_heat ?? game.current_heat;
        game.current_money = msg.state.current_money ?? game.current_money;
        game.exotic_particles = msg.state.exotic_particles ?? game.exotic_particles;
        runtime.current_power = msg.state.current_power ?? runtime.current_power;
        runtime.protium_particles = msg.state.protium_particles ?? runtime.protium_particles;
        game._protium_particles = runtime.protium_particles;

        if (msg.state.game_flags) {
          Object.assign(game, msg.state.game_flags);
        }

        if (msg.state.tiles) {
          for (const entry of msg.state.tiles) {
            const tile = game.tiles[entry.row][entry.col];
            tile.part = entry.partId ? game.part_objects[entry.partId] : null;
            tile.setTicks(entry.ticks ?? 0);
            tile.setHeat_contained(entry.heat_contained ?? 0);
            tile.activated = entry.activated ?? false;
          }
        }

        tileQueue.length = 0;
        if (msg.state.tile_queue) {
          for (const entry of msg.state.tile_queue) {
            tileQueue.push(game.tiles[entry.row][entry.col]);
          }
        }
      }

      rebuildTopology(game, runtime);
      break;
    }

    case 'rebuild_topology': {
      const result = createTickResult();
      result.flags.rebuildTopology = true;
      Object.assign(result.stats, rebuildTopology(game, runtime));
      postTick(result);
      break;
    }

    case 'get_state':
      self.postMessage({
        type: 'state',
        id: msg.id,
        payload: serializeSimState(game, runtime, msg.extras || {}),
      });
      break;

    case 'add_dtime':
      if (loopApi) {
        loopApi.dtime += msg.ms ?? 0;
      }
      break;
  }
}
