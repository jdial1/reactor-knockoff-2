import { tileIndex } from '../engine/tile-index.js';

export function createWorkerBridge(deps) {
  const worker = new Worker(new URL('../worker/game-worker.js', import.meta.url), {
    type: 'module',
  });

  let ready = false;
  let pendingId = 0;
  const pendingCallbacks = new Map();
  const pendingCommands = [];
  const metrics = {
    tickMessages: 0,
    tickBytesTotal: 0,
    maxTickBytes: 0,
    saveTriggers: 0,
    meltdownMessages: 0,
    lastSeq: 0,
  };

  function recordTick(payload) {
    const bytes = JSON.stringify(payload).length;
    metrics.tickMessages += 1;
    metrics.tickBytesTotal += bytes;
    if (bytes > metrics.maxTickBytes) metrics.maxTickBytes = bytes;
    if (payload?.seq) metrics.lastSeq = payload.seq;
    if (payload?.flags?.save) metrics.saveTriggers += 1;
  }

  function resetMetrics() {
    metrics.tickMessages = 0;
    metrics.tickBytesTotal = 0;
    metrics.maxTickBytes = 0;
    metrics.saveTriggers = 0;
    metrics.meltdownMessages = 0;
    metrics.lastSeq = 0;
  }

  function getMetrics() {
    const avgTickBytes =
      metrics.tickMessages > 0 ? Math.round(metrics.tickBytesTotal / metrics.tickMessages) : 0;
    return { ...metrics, avgTickBytes };
  }

  function send(type, payload = {}) {
    return new Promise((resolve) => {
      const id = ++pendingId;
      pendingCallbacks.set(id, resolve);
      worker.postMessage({ type, ...payload, id });
    });
  }

  function flushPendingCommands() {
    while (pendingCommands.length) {
      worker.postMessage(pendingCommands.shift());
    }
  }

  function postCommand(msg) {
    if (!ready) {
      pendingCommands.push(msg);
      return;
    }
    worker.postMessage(msg);
  }

  worker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === 'ready') {
      ready = true;
      flushPendingCommands();
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb();
      }
      return;
    }

    if (msg.type === 'ack') {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb();
      }
      return;
    }

    if (msg.type === 'tick') {
      recordTick(msg.payload);
      syncFromTick(msg.payload);
      if (msg.payload?.flags?.meltingDown === true) {
        deps.game.has_melted_down = true;
      }
      deps.paintCycle.ingestTickResult(msg.payload);
      return;
    }

    if (msg.type === 'meltdown') {
      metrics.meltdownMessages += 1;
      metrics.saveTriggers += 1;
      deps.save();
      return;
    }

    if (msg.type === 'state') {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb(msg.payload);
      }
    }
  };

  function syncFromTick(payload) {
    const { stats, tileDiffs, visualEvents } = payload;

    for (const [name, value] of Object.entries(stats || {})) {
      if (name === 'current_power') deps.runtime.current_power = value;
      else if (name === 'max_power') deps.runtime.max_power = value;
      else if (name === 'max_heat') deps.runtime.max_heat = value;
      else if (name === 'current_heat') deps.game.current_heat = value;
      else if (name === 'current_money') deps.game.current_money = value;
      else if (name === 'exotic_particles') deps.game.exotic_particles = value;
      else if (name === 'protium_particles') deps.runtime.protium_particles = value;
      else if (name === 'total_power') deps.game.stats_power = value;
      else if (name === 'stats_cash') deps.game.stats_cash = value;
    }

    for (const diff of tileDiffs || []) {
      const row = Math.floor(diff.index / deps.game.max_cols);
      const col = diff.index % deps.game.max_cols;
      const tile = deps.game.tiles[row]?.[col];
      if (!tile) continue;

      if (diff.ticks !== undefined) tile.setTicks(diff.ticks);
      if (diff.heat_contained !== undefined) tile.setHeat_contained(diff.heat_contained);
      if (diff.activated !== undefined) tile.activated = diff.activated;
      if (diff.partId !== undefined) {
        tile.part = diff.partId ? deps.game.part_objects[diff.partId] : null;
      }
    }

    for (const event of visualEvents || []) {
      if (event.type === 'part_removed') {
        const row = Math.floor(event.index / deps.game.max_cols);
        const col = event.index % deps.game.max_cols;
        const tile = deps.game.tiles[row]?.[col];
        if (tile && tile.part) {
          tile.part = null;
          tile.setTicks(0);
          tile.setHeat_contained(0);
        }
      }
    }
  }

  function buildSyncState() {
    const tiles = [];
    for (const tile of deps.game.active_tiles_2d) {
      if (tile.part || tile.activated || tile.ticks || tile.heat_contained) {
        tiles.push({
          row: tile.row,
          col: tile.col,
          partId: tile.part?.id ?? null,
          ticks: tile.ticks,
          activated: tile.activated,
          heat_contained: tile.heat_contained,
        });
      }
    }

    return {
      current_heat: deps.game.current_heat,
      current_money: deps.game.current_money,
      current_power: deps.runtime.current_power,
      exotic_particles: deps.game.exotic_particles,
      protium_particles: deps.runtime.protium_particles,
      tiles,
      tile_queue: deps.tile_queue.map((t) => ({ row: t.row, col: t.col })),
      game_flags: {
        paused: deps.game.paused,
        time_flux: deps.game.time_flux,
        auto_sell_disabled: deps.game.auto_sell_disabled,
        auto_buy_disabled: deps.game.auto_buy_disabled,
        heat_controlled: deps.game.heat_controlled,
        heat_outlet_controlled: deps.game.heat_outlet_controlled,
        loop_wait: deps.game.loop_wait,
        auto_sell_multiplier: deps.game.auto_sell_multiplier,
        heat_power_multiplier: deps.game.heat_power_multiplier,
        transfer_capacitor_multiplier: deps.game.transfer_capacitor_multiplier,
        transfer_plating_multiplier: deps.game.transfer_plating_multiplier,
        vent_capacitor_multiplier: deps.game.vent_capacitor_multiplier,
        vent_plating_multiplier: deps.game.vent_plating_multiplier,
        altered_max_heat: deps.game.altered_max_heat,
        altered_max_power: deps.game.altered_max_power,
      },
    };
  }

  function syncFromMain() {
    postCommand({ type: 'command', cmd: 'sync_state', state: buildSyncState() });
  }

  async function init(savePayload) {
    ready = false;
    pendingCommands.length = 0;
    await send('init', {
      payload: {
        save: savePayload,
        runtime: {
          current_power: deps.runtime.current_power,
          max_heat: deps.runtime.max_heat,
          max_power: deps.runtime.max_power,
          protium_particles: deps.runtime.protium_particles,
        },
        tile_queue: deps.tile_queue.map((t) => ({ row: t.row, col: t.col })),
      },
    });
  }

  function command(cmd, data = {}) {
    postCommand({ type: 'command', cmd, ...data });
  }

  function pause() {
    command('pause');
  }

  function unpause() {
    command('unpause');
  }

  function addDtime(ms) {
    command('add_dtime', { ms });
  }

  return {
    worker,
    init,
    command,
    pause,
    unpause,
    addDtime,
    syncFromMain,
    getMetrics,
    resetMetrics,
    getState: () =>
      new Promise((resolve) => {
        const id = ++pendingId;
        pendingCallbacks.set(id, resolve);
        postCommand({ type: 'command', cmd: 'get_state', id });
      }),
    get ready() {
      return ready;
    },
    get loop_timeout() {
      return null;
    },
    set loop_timeout(_v) {},
    get last_tick_time() {
      return null;
    },
    set last_tick_time(_v) {},
    game_loop() {},
  };
}

export { tileIndex as tileIndexForBridge };
