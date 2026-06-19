import { $, fmt, addProperty, updateProperty } from '../lib/globals.js';
import { Game } from '../engine/game.js';
import { Part } from '../engine/part.js';
import { Tile, setTileEmit } from '../engine/tile.js';
import hotkeys from '../engine/macros.js';
import { resolveMacroAction } from '../engine/macro-resolve.js';
import parts from '../data/parts.js';
import upgradesFactory from '../data/upgrades.js';
import objectivesFactory from '../data/objectives.js';
import { createSerialize, createLoad } from '../save/serialize.js';
import { createPlacement } from '../engine/placement.js';
import { rebuildTopology } from '../engine/sim-topology.js';
import { createPaintCycle } from '../ui/paint-cycle.js';
import { createWorkerBridge } from '../ui/worker-bridge.js';
import { tileIndex } from '../engine/tile-index.js';
import { migrateFromLocalStorage } from '../save/save-manager.js';
import { attachPartTooltipMethods } from '../ui/part-tooltip.js';
import { Upgrade } from '../ui/upgrade.js';
import { syncGridDimensions, syncMobilePartsDrawer, bindPaintCycle } from '../ui/app-ui.js';
import { initReactorViewport } from '../ui/reactor-viewport.js';
import { initPopoverInspector, isInspectorShowing, getTooltipUpdate } from '../ui/popover-inspector.js';
import { initMacroMode } from '../ui/macro-mode.js';
import { initTileGestures } from '../ui/tile-gestures.js';
import { haptic } from '../ui/haptics.js';
import { alertDialog, confirmDialog } from '../ui/dialog-service.js';

export async function initGame(ui, save_manager) {
/*

TODO:

Bugs:
stats display issue on mobile
Replace All doesn't work as expected on depleted cells on mobile

Ongoing:
adjust ui
mobile ui
parts ui adjust
browser testing

when placed, change tooltip/focus to tile
Add "purchase" to tooltip for upgrades?
Add "sell all of type" button
saving/loading indicator, cancel save/load button
unshift vents - vent6 power issue?
figure out reflector experiment upgrade
finish help section
Statistics
idle countdown timer & upgrades
Hotkeys for place part, delete/sell all, close tooltip, focus navs, pages, pause, etc
multiple reactors
make stats unlockable
header buttons
fix close/delete buttons on tooltip
fix upgrade/experiment display
"story" objectives
new cells
tooltip
modal messages
Bundling cells to 9+
towns with different power needs and compensation
Options page - exponential formatting
test speed of loops
try big int library
ui.js - put purely ui control stuff in there
Alert user when there is an update available

Make an auto-updater that updates without reloading
shift + right click on spent cells also gets rid of unspent cells
document part/upgrade keys
right click to sell upgrades?
decouple tooltip code
achievement system
save layouts
Scrounge

console.log
*/


/////////////////////////////
// General
/////////////////////////////



var game = new Game();
setTileEmit((type, name, val) => ui.say(type, name, val));
ui.init(game);
game.ui = ui;

// Current
var current_power;
var max_heat;
var max_power;
var power_multiplier;
var heat_multiplier;
var protium_particles;

var total_exotic_particles = 0;

var set_defaults = function() {
	game.current_heat = 0;
	current_power = 0;
	game.current_money = game.base_money;
	game.cols = game.base_cols;
	game.rows = game.base_rows;
	max_heat = game.base_max_heat;
	game.auto_sell_multiplier = 0;
	max_power = game.base_max_power;
	game.loop_wait = game.base_loop_wait;
	power_multiplier = game.base_power_multiplier;
	heat_multiplier = game.base_heat_multiplier;
	game.manual_heat_reduce = game.base_manual_heat_reduce;
	game.vent_capacitor_multiplier = 0;
	game.vent_plating_multiplier = 0;
	game.transfer_capacitor_multiplier = 0;
	game.transfer_plating_multiplier = 0;
	game.heat_power_multiplier = 0;
	game.heat_controlled = 0;
	game.time_flux = true;
	game.heat_outlet_controlled = 0;
	game.altered_max_heat = game.base_max_heat;
	game.altered_max_power = game.base_max_power;
	protium_particles = 0;
};

/////////////////////////////
// Online Saves and related functions
/////////////////////////////


save_manager.init(game);
game.save_manager = save_manager;

var $enable_google_drive_save = $('#enable_google_drive_save');
var $enable_local_save = $('#enable_local_save');

var local_saver = new save_manager.LocalSaver();
var google_saver = new save_manager.GoogleSaver();

var save_game = local_saver;

// Local
var enable_local_save = function(event) {
	if ( event ) {
		event.preventDefault();
	}

	save_game = local_saver;
	$enable_local_save.style.display = 'none';
	$enable_google_drive_save.style.display = null;
	save_game.enable();
};

$enable_local_save.onclick = enable_local_save;

// Google Drive
var enable_google_drive_save = async function(event) {
	if ( event ) {
		event.preventDefault();
	}

	if ( google_saver.loadfailed ) {
		await alertDialog('google drive script failed to load, unable to enable feature, try reloading the page', { title: 'Google Drive' });
		return
	}

	save_game = google_saver;
	$enable_google_drive_save.style.display = 'none';
	$enable_local_save.style.display = null;

	save_game.enable(async function() {
		if (
			await confirmDialog('Save file found. Use Google Drive save file?', { title: 'Google Drive Save' })
			|| !(await confirmDialog('Really delete the Google Drive save file? This action cannot be undone.', { title: 'Delete Save', confirmLabel: 'Delete' }))
		) {
			document.location.reload();
		} else {
			save();
		}
	}, event);
};

$enable_google_drive_save.onclick = enable_google_drive_save;

// Save handler
var save_timeout;
var save = function(event) {
	if ( event ) {
		event.preventDefault();
	}

	clearTimeout(save_timeout);

	save_game.save(
		game.saves(),
		function() {
			game.save_debug && console.log('saved');
			if ( game.debug === false ) {
				save_timeout = setTimeout(save, game.save_interval);
			}
		}
	);
};

/////////////////////////////
// Reboot (Decoupled)
/////////////////////////////

function reboot(refund) {
	workerBridge?.pause();

	set_defaults();

	for ( tile of game.tiles_2d ) {
		remove_part(tile, true);
		tile.disable();
	}

	total_exotic_particles += game.exotic_particles;
	ui.say('var', 'total_exotic_particles', total_exotic_particles);

	if ( refund === true ) {
		for ( upgrade of game.upgrade_objects_array ) {
			upgrade.setLevel(0);
		}

		game.current_exotic_particles = total_exotic_particles;
	} else {
		for ( upgrade of game.upgrade_objects_array ) {
			if ( !upgrade.ecost ) {
				upgrade.setLevel(0);
			} else {
				upgrade.setLevel(upgrade.level);
			}
		}

		game.current_exotic_particles += game.exotic_particles;
	}

	update_tiles();

	game.exotic_particles = 0;

	ui.say('var', 'exotic_particles', game.exotic_particles);
	ui.say('var', 'current_exotic_particles', game.current_exotic_particles);

	update_nodes();

	if (!game.paused) {
		workerBridge?.unpause();
	}
	syncWorker();
};

// For iteration
var i;
var l;
var ri;
var pi;
var pl;
var ci;
var row;
var col;
var tile;
var upgrade;

// Other vars
var single_cell_description = 'Produces %power power and %heat heat per tick. Lasts for %ticks ticks.';
var multi_cell_description = 'Acts as %count %type cells. Produces %power power and %heat heat per tick.';

/////////////////////////////
// Tiles
/////////////////////////////

// create tiles
for ( ri = 0; ri < game.max_rows; ri++ ) {
	row = [];

	for ( ci = 0; ci < game.max_cols; ci++ ) {
		tile = new Tile(ri, ci);
		row.push(tile);
		game.tiles_2d.push(tile);
		ui.say('evt', 'tile_added', {
			row: ri,
			column: ci,
			tile: tile
		});

		tile.disable();
	}

	game.tiles.push(row);
}

// Operations
var tile_containment;
var tile_cell;
var tile_part;
var tile_reflector;
var heat_remove;
var paintCycle;
var workerBridge;

function syncWorker() {
	if (workerBridge?.ready) {
		workerBridge.syncFromMain();
	}
}

var simRuntime = {
	active_cells: [],
	stat_vent: 0,
	stat_inlet: 0,
	stat_outlet: 0,
	transfer_multiplier: 0,
	vent_multiplier: 0,
	get current_power() { return current_power; },
	set current_power(v) { current_power = v; },
	get max_heat() { return max_heat; },
	set max_heat(v) { max_heat = v; },
	get max_power() { return max_power; },
	set max_power(v) { max_power = v; },
	get protium_particles() { return protium_particles; },
	set protium_particles(v) { protium_particles = v; },
};

var update_tiles = function() {
	const stats = rebuildTopology(game, simRuntime);

	for (const [key, value] of Object.entries(stats)) {
		ui.say('var', key, value);
	}

	syncWorker();
};

// get dom nodes cached
var $reactor = $('#reactor');
var $all_parts = $('#all_parts');

var $main = $('#main');
var $all_upgrades = $('#all_upgrades');

// Tooltip
var popoverApi;

function initInspector() {
	popoverApi = initPopoverInspector({
		mainEl: $main,
		reactorEl: $reactor,
		allPartsEl: $all_parts,
		allUpgradesEl: $all_upgrades,
		syncMobilePartsDrawer,
		Upgrade,
	});
}

if ( game.debug ) {
	$main.classList.add('debug');
}

ui.say('var', 'max_heat', max_heat);
ui.say('var', 'max_power', max_power);

initInspector();

/////////////////////////////
// Parts
/////////////////////////////



game.parts = parts;

var part_obj;
var part_settings;
var part;
var cell_prefixes = ['', 'Dual ', 'Quad '];
var prefixes = ['Basic ', 'Advanced ', 'Super ', 'Wonderous ', 'Ultimate '];
var cell_power_multipliers = [1, 4, 12];
var cell_heat_multipliers = [1, 8, 36];
var cell_counts = [1, 2, 4, 9, 16];

var create_part = function(part, level=part.level) {
	if ( level ) {
		part = Object.assign({}, part);
		part.level = level;

		part.base_cost *= Math.pow(part.cost_multiplier || 1, level - 1);

		if ( part.category === 'cell' ) {
			part.id = part.type + level;
			part.title = (cell_prefixes[level -1] || '') + part.title;

			if ( level > 1 ) {
				part.base_description = multi_cell_description;
			}
			part.power = part.base_power * cell_power_multipliers[level - 1];
			part.heat = part.base_heat * cell_heat_multipliers[level - 1];

			part.cell_count = cell_counts[level - 1];
			part.cell_multiplier = cell_power_multipliers[level - 1];
			part.pulse_multiplier = 1;
		} else {
			part.id = part.category + level;
			part.title = (prefixes[level -1] || '') + part.title;

			if ( part.base_ticks && part.ticks_multiplier ) {
				part.base_ticks = part.base_ticks * Math.pow(part.ticks_multiplier, level - 1);
			}

			if ( part.base_containment && part.containment_multiplier ) {
				part.base_containment = part.base_containment * Math.pow(part.containment_multiplier, level - 1);
			}

			if ( part.base_reactor_power && part.reactor_power_multiplier ) {
				part.base_reactor_power = part.base_reactor_power * Math.pow(part.reactor_power_multiplier, level - 1);
			}

			if ( part.base_reactor_heat && part.reactor_heat_multiplier ) {
				part.base_reactor_heat = part.base_reactor_heat * Math.pow(part.reactor_heat_multiplier, level - 1);
			}

			if ( part.base_transfer && part.transfer_multiplier ) {
				part.base_transfer = part.base_transfer * Math.pow(part.transfer_multiplier, level - 1);
			}

			if ( part.base_vent && part.vent_multiplier ) {
				part.base_vent = part.base_vent * Math.pow(part.vent_multiplier, level - 1);
			}

			if ( part.base_ep_heat && part.ep_heat_multiplier ) {
				part.base_ep_heat = part.base_ep_heat * Math.pow(part.ep_heat_multiplier, level - 1);
			}

			if ( part.base_power_increase && part.power_increase_add ) {
				part.base_power_increase = part.base_power_increase + part.power_increase_add * level - 1;
			}

			if ( part.base_heat_increase ) {
				part.base_heat_increase = part.base_heat_increase;
			}

		}
	}

	part_obj = new Part(part);

	game.part_objects[part.id] = part_obj;
	game.part_objects_array.push(part_obj);

	part_obj.updateDescription();
	ui.say('evt', 'part_added', part_obj);

	return part_obj;
}

attachPartTooltipMethods(Part, game, fmt, () => simRuntime.transfer_multiplier, () => simRuntime.vent_multiplier, $, single_cell_description, multi_cell_description);

for ( pi = 0, pl = parts.length; pi < pl; pi++ ) {
	part_settings = parts[pi];
	if ( part_settings.levels ) {
		for ( i = 0, l = part_settings.levels; i < l; i++ ) {
			create_part(part_settings, i + 1);
		}
	} else {
		create_part(part_settings);
	}
}

game.update_cell_power = function() {
	var part;

	for ( var i = 0, l = game.part_objects_array.length; i < l; i++ ) {
		part = game.part_objects_array[i];

		if ( part.category === 'cell' ) {
			if ( game.upgrade_objects['cell_power_' + part.part.type] ) {
				part.base_power = part.part.base_power * (game.upgrade_objects['cell_power_' + part.part.type].level + game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
				part.power = part.part.power * (game.upgrade_objects['cell_power_' + part.part.type].level + game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
			} else {
				part.base_power = part.part.base_power * (game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
				part.power = part.part.power * (game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
			}

			if ( part.part.type === 'protium' ) {
				// TODO: DRY this
				part.base_power = part.part.base_power * (game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unstable_protium'].level) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
				part.base_power *= 1 + protium_particles / 10;
				part.power = part.part.power * (game.upgrade_objects['infused_cells'].level + 1) * Math.pow(2, game.upgrade_objects['unstable_protium'].level) * Math.pow(2, game.upgrade_objects['unleashed_cells'].level);
				part.power *= 1 + protium_particles / 10;
			}
		}
	}
};

/////////////////////////////
// Reduce Heat Manually (Decoupled)
/////////////////////////////

function manual_reduce_heat() {
	if ( game.current_heat ) {
		game.current_heat -= game.manual_heat_reduce;

		if ( game.current_heat < 0 ) {
			game.current_heat = 0;
		}

		if ( game.current_heat === 0 ) {
			game.sold_heat = true;
		}

		ui.say('var', 'current_heat', game.current_heat);
		syncWorker();
	}
};

/////////////////////////////
// Upgrades
/////////////////////////////

game.epart_onclick = function(upgrade) {
	var eparts_count = 0;

	for ( var i = 0, l = game.upgrade_objects_array.length; i < l; i++) {
		if ( game.upgrade_objects_array[i].upgrade.type === 'experimental_parts' && game.upgrade_objects_array[i].level ) {
			eparts_count++;
		}
	}

	for ( var i = 0, l = game.upgrade_objects_array.length; i < l; i++) {
		if ( game.upgrade_objects_array[i].upgrade.type === 'experimental_parts' && !game.upgrade_objects_array[i].level ) {
			game.upgrade_objects_array[i].ecost = game.upgrade_objects_array[i].upgrade.ecost * (eparts_count + 1);
			// TODO: Maybe find a better way to do this
			game.upgrade_objects_array[i].display_cost = fmt(game.upgrade_objects_array[i].ecost);
		}
	}
};

var upgrades = upgradesFactory(game);

// More stuff I guess

var upgrade_locations = {
	cell_tick_upgrades: $('#cell_tick_upgrades'),
	cell_power_upgrades: $('#cell_power_upgrades'),
	cell_perpetual_upgrades: $('#cell_perpetual_upgrades'),
	other: $('#other_upgrades'),
	vents: $('#vent_upgrades'),
	exchangers: $('#exchanger_upgrades'),
	experimental_laboratory: $('#experimental_laboratory'),
	experimental_boost: $('#experimental_boost'),
	experimental_cells: $('#experimental_cells'),
	experimental_cells_boost: $('#experimental_cell_boost'),
	experimental_parts: $('#experimental_parts'),
	experimental_particle_accelerators: $('#experimental_particle_accelerators')
};

var create_upgrade = function(u) {
	u.levels = u.levels || game.upgrade_max_level;
	var upgrade = new Upgrade(u);
	upgrade.$el.upgrade = upgrade;

	if ( u.classList ) {
		upgrade.$el.classList.add(...u.classList);
	}

	upgrade_locations[u.type].appendChild(upgrade.$el);
	game.upgrade_objects_array.push(upgrade);
	game.upgrade_objects[upgrade.upgrade.id] = upgrade;
};

for ( var i = 0, l = upgrades.length; i < l; i++ ) {
	create_upgrade(upgrades[i]);
}

for ( var i = 0, l = game.upgrade_objects_array.length; i < l; i++ ) {
	game.upgrade_objects_array[i].setLevel(0);
}

// Upgrade delegate event
var upgrade_func = function(upgrade) {
	if ( upgrade.level >= upgrade.upgrade.levels ) {
		return;
	} else if (
		upgrade.ecost
		&& (!upgrade.erequires || game.upgrade_objects[upgrade.erequires].level)
		&& game.current_exotic_particles >= upgrade.ecost
	) {
		game.current_exotic_particles -= upgrade.ecost;
		ui.say('var', 'current_exotic_particles', game.current_exotic_particles);
	} else if ( upgrade.cost && game.current_money >= upgrade.cost ) {
		game.current_money -= upgrade.cost;
		ui.say('var', 'current_money', game.current_money);
	} else {
		return;
	}

	upgrade.setLevel(upgrade.level + 1);
	if ( isInspectorShowing() ) {
		upgrade.updateTooltip();
	}
	update_tiles();
	return true
}

$all_upgrades.delegate('upgrade', 'click', function(event){
	let result;
	do {
		result = upgrade_func(this.upgrade);
	} while ( event.shiftKey && result )
});

if ( game.debug ) {
	$all_upgrades.delegate('upgrade', 'mousedown', function(event) {
		if ( event.which === 3 ) {
			var upgrade = this.upgrade;
			event.preventDefault();

			if ( upgrade.level > 0 ) {
				upgrade.setLevel(upgrade.level - 1);
				if ( isInspectorShowing() ) {
					upgrade.updateTooltip();
				}
				game.current_exotic_particles += upgrade.ecost;
				ui.say('var', 'current_exotic_particles', game.current_exotic_particles);
				update_tiles();
			}
		}
	});
}

function check_upgrades_affordability( ) {
	for ( var upgrade of game.upgrade_objects_array ) {

		if (
			upgrade.level < upgrade.upgrade.levels
			&& (
				(
					upgrade.cost
					&& game.current_money >= upgrade.cost
				)
				||
				(
					upgrade.ecost
					&& (!upgrade.erequires || game.upgrade_objects[upgrade.erequires].level)
					&& (game.current_exotic_particles > upgrade.ecost)
				)
			)
		) {
			if ( upgrade.affordable === false ) {
				upgrade.setAffordable(true);
			}
		} else if ( upgrade.affordable === true ) {
			upgrade.setAffordable(false);
		}
	}
};

// Select part
var clicked_part = null;

$all_parts.delegate('part', 'click', function(e) {
	if ( clicked_part && clicked_part === this._part ) {
		clicked_part = null;
		this.classList.remove('part_active');
		$main.classList.remove('part_active');
		$main.classList.add('parts_expanded');
		popoverApi.hide();
		syncMobilePartsDrawer($main);
	} else {
		popoverApi.showPartTooltip.apply(this, e);

		if ( clicked_part ) {
			clicked_part.$el.classList.remove('part_active');
			$main.classList.remove('part_active');
		}

		clicked_part = this._part;
		this.classList.add('part_active');
		$main.classList.add('part_active');
		$main.classList.remove('parts_expanded');
		syncMobilePartsDrawer($main);
	}
});


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
    get last_tick_time() { return workerBridge?.last_tick_time; },
    set last_tick_time(v) { if (workerBridge) workerBridge.last_tick_time = v; },
    get loop_timeout() { return workerBridge?.loop_timeout; },
    set loop_timeout(v) { if (workerBridge) workerBridge.loop_timeout = v; },
    get save_timeout() { return save_timeout; },
    set save_timeout(v) { save_timeout = v; },
    tile_queue,
  };
}

function wireRuntime() {
  paintCycle = createPaintCycle({
    game,
    ui,
    reactorSection: $('#reactor_section'),
    save,
    removePartDom: (tile) => placementApi?.removePartDom(tile),
    getCurrentHeat: () => game.current_heat,
    getMaxHeat: () => max_heat,
    flushAffordability: () => ui.update_interface(),
    onHidden: () => {
      if (workerBridge?.ready) workerBridge.pause();
    },
    onVisible: () => {
      if (workerBridge?.ready && !game.paused) workerBridge.unpause();
    },
  });

  bindPaintCycle(paintCycle);

  placementApi = createPlacement({
    game,
    ui,
    get clicked_part() { return clicked_part; },
    set clicked_part(v) { clicked_part = v; },
    tile_queue,
    update_tiles,
    get tile_mousedown_right() { return tile_mousedown_right; },
    get workerBridge() { return workerBridge; },
  });

  workerBridge = createWorkerBridge({
    game,
    ui,
    runtime: simRuntime,
    paintCycle,
    tile_queue,
    save,
    placementApi,
    getClickedPart: () => clicked_part,
    update_tiles,
  });

  loopApi = workerBridge;
  game_loop = workerBridge.game_loop;

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
    game_loop: workerBridge.game_loop,
    reinitWorker: async () => {
      await workerBridge.init(game.saves());
      if (!game.paused) {
        workerBridge.unpause();
      } else {
        workerBridge.pause();
      }
    },
  });
  game.loads = loads;
}

var apply_to_tile;
var remove_part;
var mouse_apply_to_tile;

// Add part to tile
var part_replace = /[\b\s]part_[a-z0-9_]+\b/;
var category_replace = /[\b\s]category_[a-z_]+\b/;
var tile_mousedown = false;
var tile_mousedown_right = false;
var tile_queue = [];
var qi;
var tile2;

// Pause (Decoupled)
function pause() {
	workerBridge?.pause();
	game.paused = true;
	ui.say('evt', 'paused');
};

function unpause() {
	workerBridge?.unpause();
	game.paused = false;
	ui.say('evt', 'unpaused');
};

// Enable/Disable auto sell (Decoupled)
function disable_auto_sell() {
	game.auto_sell_disabled = true;
	ui.say('evt', 'auto_sell_disabled');
	syncWorker();
};

function enable_auto_sell() {
	game.auto_sell_disabled = false;
	ui.say('evt', 'auto_sell_enabled');
	syncWorker();
};

function disable_auto_buy() {
	game.auto_buy_disabled = true;
	ui.say('evt', 'auto_buy_disabled');
	syncWorker();
};

function enable_auto_buy() {
	game.auto_buy_disabled = false;
	ui.say('evt', 'auto_buy_enabled');
	syncWorker();
};

function disable_heat_control() {
	game.heat_controlled = false;
	ui.say('evt', 'heat_control_disabled');
	syncWorker();
};

function enable_heat_control() {
	game.heat_controlled = true;
	ui.say('evt', 'heat_control_enabled');
	syncWorker();
};

function disable_time_flux() {
	game.time_flux = false;
	ui.say('evt', 'time_flux_disabled');
	syncWorker();
};

function enable_time_flux() {
	game.time_flux = true;
	ui.say('evt', 'time_flux_enabled');
	syncWorker();
};

/////////////////////////////
// Tile clicks
/////////////////////////////

var tile_mouseup = false;
var placement_drag_bulk = false;
var tile_mouseup_fn = function(e) {
	if (placement_drag_bulk) {
		update_tiles();
		placementApi.endBulkEdit();
		placement_drag_bulk = false;
		haptic('placement');
	}
	tile_mouseup = true;
	tile_mousedown = false;
	tile_mousedown_right = false;
};

document.oncontextmenu = function(e) {
	if ( tile_mousedown_right ) {
		e.preventDefault();
	}
};

$reactor.delegate('tile', 'click', function(e) {
	// Mouse up get trigger before click,
	// So we check if the event was actually mouse related
	if ( tile_mouseup ) {
		tile_mouseup = false;
	// TODO: check if we can remove this check
	} else if ( !tile_mousedown ) {
		placementApi.mouse_apply_to_tile.call(this, e);
	}
});



hotkeys.init(game);
game.hotkeys = hotkeys;

var last_click = null;
var last_tile = null;
var double_click_tile = null;
var double_click_tile_part = null;
var double_click_tile_ticks = null;
var clear_double_click_task = null;
var clear_double_click = function() {
	double_click_tile = null;
	double_click_tile_part = null;
};

var part_replacement_result;
var tiles;

var click_func = function(e) {
	const resolved = resolveMacroAction(hotkeys, this, {
		shiftKey: e.shiftKey,
		ctrlKey: e.ctrlKey,
		altKey: e.altKey,
		isRightClick: tile_mousedown_right,
		isDoubleClick: double_click_tile && last_click === e.which && double_click_tile === this.tile,
		doubleClickPart: double_click_tile_part,
		doubleClickTicks: double_click_tile_ticks,
		part_replaceable: placementApi.part_replaceable,
	});
	part_replacement_result = resolved.part_replacement_result;
	return resolved.tiles;
};

var apply_macro_tiles = function(tilesIterator, e) {
	placementApi.beginBulkEdit();
	for (const tile of tilesIterator) {
		placementApi.mouse_apply_to_tile.call(tile.$el, e, true, part_replacement_result);
	}
	update_tiles();
	placementApi.endBulkEdit();
	haptic('placement');
};

$reactor.delegate('tile', 'mousedown', function(e) {
	tile_mousedown = true;
	tile_mousedown_right = e.which === 3;

	if (tiles = click_func.call(this, e)) {
		apply_macro_tiles(tiles, e);
	} else {
		double_click_tile_part = this.tile.part;
		double_click_tile_ticks = this.tile.ticks;
		placementApi.beginBulkEdit();
		placement_drag_bulk = true;
		mouse_apply_to_tile.call(this, e, true);
		double_click_tile = this.tile;
	}

	last_click = e.which;
	last_tile = this.tile;

	if (clear_double_click_task){
		clearTimeout(clear_double_click_task)
	}
	clear_double_click_task = setTimeout(clear_double_click, 300);
});

$reactor.onmouseup = tile_mouseup_fn;
$reactor.onmouseleave = tile_mouseup_fn;

$reactor.delegate('tile', 'mousemove', function(e) {
	if ( tile_mousedown && last_tile != this.tile ) {
		last_tile = this.tile;
		if ( tiles = click_func.call(this, e) ) {
			apply_macro_tiles(tiles, e);
		} else if (placement_drag_bulk) {
			mouse_apply_to_tile.call(this, e, true);
		}
	}
});

// Sell (Decoupled)
function sell() {
	if ( current_power ) {
		game.current_money += current_power;
		current_power = 0;

		ui.say('var', 'current_money', game.current_money);
		ui.say('var', 'current_power', current_power);

		game.sold_power = true;
		syncWorker();
	}
};

/////////////////////////////
// Scrounge
/////////////////////////////

/* var $scrounge = $('#scrounge');

$scrounge.onclick = function() {
	if ( current_money < 10 && current_power === 0 ) {
		current_money += 1;

		ui.say('var', 'current_money', current_money);
	}
}; */

/////////////////////////////
var prev_part;
// affordability loop
function check_affordability() {
	prev_part = null;

	for ( var i = 0, l = game.part_objects_array.length; i < l; i++ ) {
		var part = game.part_objects_array[i];

		if (
			part.affordable === true
			&&
				(
					part.cost > game.current_money
					|| (part.erequires && !game.upgrade_objects[part.erequires].level)
				)
		) {
			part.setAffordable(false);
		} else if ( !part.affordable ) {
			if (
				part.cost <= game.current_money
				&& (!part.erequires || game.upgrade_objects[part.erequires].level)
			) {
				part.setAffordable(true);
			} else if ( prev_part && prev_part.affordable ) {
				part.$el.classList.removed('locked');
			}
		}
	}
};

/////////////////////////////
// Objectives
/////////////////////////////

var objectives = objectivesFactory(game);
var current_objective = 0;
var objective_unloading = false;
var objective;
var objective_interval = 2000;
var objective_wait = 3000;
var objective_timeout;

var check_objectives = function() {
	if ( !game.paused && objective && objective.check() ) {
		current_objective++;
		if ( objective.reward ) {
			game.current_money += objective.reward;
			ui.say('var', 'current_money', game.current_money);
		} else if ( objective.ep_reward ) {
			game.exotic_particles += objective.ep_reward;
			ui.say('var', 'exotic_particles', game.exotic_particles);
		}

		set_objective(current_objective);
	} else {
		clearTimeout(objective_timeout);
		objective_timeout = setTimeout(check_objectives, objective_interval);
	}
};

var set_objective = function(objective_key, skip_wait=false) {
	var wait = skip_wait ? 0 : objective_wait;

	if ( objectives[current_objective] ) {
		objective_unloading = true;
		ui.say('evt', 'objective_unloaded');

		clearTimeout(objective_timeout);
		objective_timeout = setTimeout(function() {
			objective = objectives[current_objective];
			ui.say('evt', 'objective_loaded', objective);
			if ( objective.start ) {
				objective.start();
			}

			clearTimeout(objective_timeout);
			objective_timeout = setTimeout(check_objectives, objective_interval);
		}, wait);
	}
};

/////////////////////////////
// Load
/////////////////////////////

var update_heat_and_power = function() {
	ui.say('var', 'current_heat', game.current_heat);
	ui.say('var', 'current_power', current_power);
};

var update_nodes = function() {
	ui.say('var', 'current_heat', game.current_heat);
	ui.say('var', 'current_power', current_power);
	ui.say('var', 'current_money', game.current_money);
	ui.say('var', 'exotic_particles', game.exotic_particles);
	ui.say('var', 'current_exotic_particles', game.current_exotic_particles);
	ui.say('var', 'total_exotic_particles', total_exotic_particles);
};

// Do stuff

if ( localStorage.getItem('google_drive_save') ) {
	save_game = google_saver;
	$enable_google_drive_save.style.display = 'none';
} else {
	$enable_local_save.style.display = 'none';
}

wireRuntime();
apply_to_tile = placementApi.apply_to_tile;
remove_part = placementApi.remove_part;
mouse_apply_to_tile = placementApi.mouse_apply_to_tile;

initMacroMode($main);
initTileGestures({
	mainEl: $main,
	reactorEl: $reactor,
	hotkeys,
	placementApi,
	update_tiles,
	getClickedPart: () => clicked_part,
});

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

if (import.meta.env.DEV) {
  window.__phase4 = {
    getMetrics: () => workerBridge.getMetrics(),
    resetMetrics: () => workerBridge.resetMetrics(),
    getWorkerState: () => workerBridge.getState(),
    placeCellLayout() {
      const tile = game.active_tiles_2d.find((t) => t.enabled && !t.part);
      if (!tile) return false;
      const part = game.part_objects['uranium1'];
      if (!part) return false;
      if (!part.className) part.className = 'part_' + part.id;
      tile.activated = true;
      tile.setTicks(part.ticks);
      apply_to_tile(tile, part, true);
      syncWorker();
      return true;
    },
    async triggerMeltdown() {
      window.pause();
      const tile = game.active_tiles_2d.find((t) => t.enabled && !t.part);
      if (!tile) return false;
      const part = game.part_objects['particle_accelerator1'];
      if (!part) return false;
      if (!part.className) part.className = 'part_' + part.id;
      tile.activated = true;
      apply_to_tile(tile, part, true);
      tile.setHeat_contained(part.containment + 1);
      syncWorker();
      workerBridge.resetMetrics();
      window.unpause();
      return true;
    },
    async runTimeFluxDebt(ms = 5000) {
      window.pause();
      workerBridge.addDtime(ms);
      window.enable_time_flux();
      workerBridge.resetMetrics();
      window.unpause();
    },
    roundTripSave() {
      const before = {
        money: game.current_money,
        heat: game.current_heat,
        tileCount: game.active_tiles_2d.filter((t) => t.part).length,
      };
      const payload = game.saves();
      game.loads(payload);
      return {
        before,
        after: {
          money: game.current_money,
          heat: game.current_heat,
          tileCount: game.active_tiles_2d.filter((t) => t.part).length,
        },
        payloadBytes: payload.length,
      };
    },
    game,
    workerBridge,
  };
}

ui.say('evt', 'game_inited');

game.onDimensionsChange = (g) => {
	syncGridDimensions(g);
	if (reactorViewport) {
		reactorViewport.refit();
	}
};
syncGridDimensions(game);

const reactorViewport = initReactorViewport($('#reactor_viewport'), $('#reactor_canvas'), $main);

await migrateFromLocalStorage();
save_game.enable();
save_game.load(game.loads);

  return { game, save, loads, reboot };
}
