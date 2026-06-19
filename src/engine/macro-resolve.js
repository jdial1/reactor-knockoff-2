export function resolveMacroAction(hotkeys, tileEl, options) {
  const tile = tileEl.tile;
  const {
    shiftKey = false,
    ctrlKey = false,
    altKey = false,
    isRightClick = false,
    isDoubleClick = false,
    doubleClickPart = null,
    doubleClickTicks = null,
    macroAction = null,
    part_replaceable,
  } = options;

  let part_replacement_result;

  if (macroAction) {
    switch (macroAction) {
      case 'checker':
        return { tiles: hotkeys.checker(tile), part_replacement_result };
      case 'shift_row':
        return { tiles: hotkeys.shift_row(tile), part_replacement_result };
      case 'shift_column':
        return { tiles: hotkeys.shift_column(tile), part_replacement_result };
      case 'row':
        return { tiles: hotkeys.row(tile), part_replacement_result };
      case 'column':
        return { tiles: hotkeys.column(tile), part_replacement_result };
      case 'replace': {
        const part = tile.part ?? doubleClickPart ?? null;
        part_replacement_result = part_replaceable?.(part);
        return { tiles: hotkeys.replacer(part), part_replacement_result };
      }
      case 'sell': {
        const part = tile.part ?? doubleClickPart;
        if (!part) return { tiles: null, part_replacement_result };
        const ticks = tile.part ? tile.ticks : doubleClickTicks;
        return { tiles: hotkeys.remover(part, ticks), part_replacement_result };
      }
      default:
        return { tiles: null, part_replacement_result };
    }
  }

  if (shiftKey && ctrlKey && altKey) {
    return { tiles: hotkeys.checker(tile), part_replacement_result };
  }
  if (shiftKey && ctrlKey) {
    return { tiles: hotkeys.shift_row(tile), part_replacement_result };
  }
  if (shiftKey && altKey) {
    return { tiles: hotkeys.shift_column(tile), part_replacement_result };
  }
  if (ctrlKey) {
    return { tiles: hotkeys.row(tile), part_replacement_result };
  }
  if (altKey) {
    return { tiles: hotkeys.column(tile), part_replacement_result };
  }
  if (shiftKey || isDoubleClick) {
    const part = shiftKey ? tile.part : doubleClickPart;
    const ticks = shiftKey ? tile.ticks : doubleClickTicks;

    if (isRightClick && part) {
      return { tiles: hotkeys.remover(part, ticks), part_replacement_result };
    }
    if (!isRightClick && part !== undefined) {
      part_replacement_result = part_replaceable?.(part);
      return { tiles: hotkeys.replacer(part), part_replacement_result };
    }
    if (!isRightClick && !part) {
      part_replacement_result = part_replaceable?.(null);
      return { tiles: hotkeys.replacer(null), part_replacement_result };
    }
  }

  return { tiles: null, part_replacement_result };
}
