export function createTickResult() {
  return {
    stats: {},
    tileDiffs: new Map(),
    visualEvents: [],
    flags: {
      rebuildTopology: false,
      meltdown: false,
      save: false,
      meltingDown: null,
    },
  };
}

export function setStat(result, name, value) {
  result.stats[name] = value;
}

export function pushVisualClass(result, index, add = [], remove = []) {
  if (add.length || remove.length) {
    result.visualEvents.push({ type: 'class', index, add, remove });
  }
}

export function pushPartRemoved(result, index) {
  result.visualEvents.push({ type: 'part_removed', index });
}

export function pushTileDiff(result, index, fields) {
  const existing = result.tileDiffs.get(index) || { index };
  Object.assign(existing, fields);
  result.tileDiffs.set(index, existing);
}

export function mergeTickResults(into, from) {
  Object.assign(into.stats, from.stats);
  for (const [index, diff] of from.tileDiffs) {
    pushTileDiff(into, index, diff);
  }
  into.visualEvents.push(...from.visualEvents);
  if (from.flags.rebuildTopology) into.flags.rebuildTopology = true;
  if (from.flags.meltdown) into.flags.meltdown = true;
  if (from.flags.save) into.flags.save = true;
  if (from.flags.meltingDown !== null) into.flags.meltingDown = from.flags.meltingDown;
}
