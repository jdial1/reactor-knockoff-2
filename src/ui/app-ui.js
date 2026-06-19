import { $, fmt } from '../lib/globals.js';
import { tileIndex } from '../engine/tile-index.js';
import { alertDialog, confirmDialog, blockGameForModal, unblockGameForModal, initDialogService } from './dialog-service.js';
import {
  initToggles,
  toggle_buttons_loads,
  toggle_buttons_saves,
  create_toggle_button,
  update_button,
} from './toggles.js';

var UI = function() {
	this.game;

	this.init = function(game) {
		this.game = game;
		initDialogService(this);
		toggleApi.refreshAll();
	}
};

var ui = new UI();
export default ui;

export function syncGridDimensions(game) {
	document.documentElement.style.setProperty('--cols', game.cols);
	document.documentElement.style.setProperty('--rows', game.rows);
}

export function syncMobilePartsDrawer(mainEl) {
	if (!mainEl || window.matchMedia('(min-width: 939px)').matches) {
		mainEl?.style.removeProperty('--parts-drawer-height');
		mainEl?.style.removeProperty('--parts-drawer-top');
		mainEl?.style.removeProperty('--reactor-stack-bottom');
		return;
	}

	if (!mainEl.classList.contains('reactor_showing')) {
		mainEl.style.removeProperty('--parts-drawer-height');
		mainEl.style.removeProperty('--parts-drawer-top');
		mainEl.style.removeProperty('--reactor-stack-bottom');
		return;
	}

	const rootStyle = getComputedStyle(document.documentElement);
	const navBarH = parseFloat(rootStyle.getPropertyValue('--nav-bar-height')) || 44;
	const tileH = parseFloat(rootStyle.getPropertyValue('--space-tile')) || 32;
	const collapsedH = tileH + 20;
	const stackEl = document.getElementById('reactor_viewport') || document.getElementById('reactor_section');
	const stackBottom = Math.ceil(stackEl?.getBoundingClientRect().bottom ?? 0);

	mainEl.style.setProperty('--reactor-stack-bottom', `${stackBottom}px`);

	if (mainEl.classList.contains('part_active')) {
		mainEl.style.setProperty('--parts-drawer-height', `${collapsedH}px`);
		mainEl.style.removeProperty('--parts-drawer-top');
		return;
	}

	if (!mainEl.classList.contains('parts_expanded')) {
		mainEl.style.setProperty('--parts-drawer-height', '28px');
		mainEl.style.removeProperty('--parts-drawer-top');
		return;
	}

	const drawerHeight = Math.max(72, window.innerHeight - stackBottom - navBarH);

	mainEl.style.setProperty('--parts-drawer-top', `${stackBottom}px`);
	mainEl.style.setProperty('--parts-drawer-height', `${drawerHeight}px`);
}

// DOM nodes
var $main = $('#main');
var $reactor = $('#reactor');
var $reactor_background = $('#reactor_background');
var $reactor_section = $('#reactor_section');
var $refund_exotic_particles = $('#refund_exotic_particles');
var $reboot_exotic_particles = $('#reboot_exotic_particles');
var $manual_heat_reduce = $('#manual_heat_reduce');
var $auto_heat_reduce = $('#auto_heat_reduce');
var $power_percentage = $('#power_percentage');
var $heat_percentage = $('#heat_percentage');
var $parts = $('#parts');
var $primary = $('#primary');
var $time_flux = $('#time_flux');
var $page_nav = $('#page_nav');

var current_vars = new Map();
var update_vars = new Map();

var perc = function(numerator, denominator, dom) {
	var num = current_vars.get(numerator) || 0;
	var den = current_vars.get(denominator) || 1;
	var percent = round_percentage(num / den);
	if ( percent > 100 ) percent = 100;
	dom.style.width = percent + '%';
	dom.dataset.fill = String(percent);
	if (dom.id === 'heat_percentage') {
		var indicator = dom.closest('#heat_indicator');
		if (indicator) {
			indicator.classList.toggle('heat-warning', percent >= 85);
		}
		applyHeatVignette(num, den);
	}
};

function applyHeatVignette(current_heat, max_heat) {
	const ratio = max_heat > 0 ? current_heat / max_heat : 0;
	const vignette = ratio >= 0.8 ? Math.min(1, (ratio - 0.8) / 0.2) : 0;
	document.documentElement.style.setProperty('--heat-vignette', String(vignette));
}

function applyCoreHeatOpacity(current_heat, max_heat) {
	const ratio =
		current_heat <= max_heat ? 0 : Math.min(1, (current_heat - max_heat) / max_heat);
	document.documentElement.style.setProperty('--core-heat-opacity', String(ratio));
	applyHeatVignette(current_heat, max_heat);
}

function updateEpButtonLabels() {
	var exotic_particles = Number(current_vars.get('exotic_particles')) || 0;
	var total = Number(current_vars.get('total_exotic_particles')) || 0;
	var current = Number(current_vars.get('current_exotic_particles')) || 0;
	$reboot_exotic_particles.textContent = fmt(exotic_particles);
	$refund_exotic_particles.textContent = fmt(total - current);
}

var timestampFmt = function(ts) {
	ts = Math.round(ts / 1000);

	var s = String(ts % 60);
	if(s.length < 2) s = '0' + s;
	ts = Math.floor(ts / 60);
	if(ts === 0) return s;

	var m = String(ts % 60);
	if(m.length < 2) m = '0' + m;
	ts = Math.floor(ts / 60);
	if(ts === 0) return m + ':' + s;

	var h = String(ts % 24);
	if(h.length < 2) h = '0' + h;
	ts = Math.floor(ts / 24);
	if(ts === 0) return h + ':' + m + ':' + s;

	var d = String(ts);
	return d + ':' + h + ':' + m + ':' + s;
}

var var_objs = {
	manual_heat_reduce: {
		onupdate: function() {
			$manual_heat_reduce.textContent = '-' + fmt(current_vars.get('manual_heat_reduce'));
		}
	},
	auto_heat_reduce: {
		onupdate: function() {
			$auto_heat_reduce.textContent = '-' + fmt(current_vars.get('auto_heat_reduce'));
		}
	},
	flux_tick_time: {
		onupdate: function() {
			var flux_tick_time = current_vars.get('flux_tick_time');
			$time_flux.textContent = flux_tick_time > 1000 ? timestampFmt(flux_tick_time) : '-';
		}
	},
	// TODO: Bad naming
	current_money: {
		dom: $('#money'),
		num: true
	},
	current_power: {
		dom: $('#current_power'),
		num: true,
		onupdate: function() {
			perc('current_power', 'max_power', $power_percentage);
		}
	},
	max_power: {
		dom: $('#max_power'),
		num: true,
		// TODO: DRY?
		onupdate: function() {
			perc('current_power', 'max_power', $power_percentage);
		}
	},
	// TODO: Bad naming
	total_power: {
		dom: $('#stats_power'),
		num: true
	},
	current_heat: {
		dom: $('#current_heat'),
		num: true,
		onupdate: function() {
			perc('current_heat', 'max_heat', $heat_percentage);
			applyCoreHeatOpacity(current_vars.get('current_heat'), current_vars.get('max_heat'));
		}
	},
	total_heat: {
		dom: $('#stats_heat'),
		num: true
	},
	max_heat: {
		dom: $('#max_heat'),
		num: true,
		onupdate: function() {
			var current_heat = current_vars.get('current_heat');
			var max_heat = current_vars.get('max_heat');

			perc('current_heat', 'max_heat', $heat_percentage);
			$auto_heat_reduce.textContent = '-' + (fmt(current_vars.get('max_heat')/10000));
			applyCoreHeatOpacity(current_heat, max_heat);
		}
	},
	exotic_particles: {
		dom: $('#exotic_particles'),
		num: true,
		onupdate: updateEpButtonLabels
	},
	current_exotic_particles: {
		dom: $('#current_exotic_particles'),
		num: true,
		onupdate: updateEpButtonLabels
	},
	total_exotic_particles: {
		onupdate: updateEpButtonLabels
	},

	stats_cash: {
		dom: $('#stats_cash'),
		num: true,
		places: 2
	},
	stats_outlet: {
		dom: $('#stats_outlet'),
		num: true,
		places: 2
	},
	stats_inlet: {
		dom: $('#stats_inlet'),
		num: true,
		places: 2
	},
	stats_vent: {
		dom: $('#stats_vent'),
		num: true,
		places: 2
	},
	stats_heat: {
		dom: $('#stats_heat'),
		num: true,
		places: 2
	},

	money_add: {
		dom: $('#money_per_tick'),
		num: true
	},
	power_add: {
		dom: $('#power_per_tick'),
		num: true
	},
	heat_add: {
		dom: $('#heat_per_tick'),
		num: true
	}
};

// Update formatted numbers
var update_var = function(obj, value) {
	if ( obj.dom ) {
		if ( obj.num ) {
			obj.dom.textContent = fmt(value, obj.places || null);
		} else {
			obj.dom.textContent = value;
		}
	}

	if ( obj.onupdate ) {
		obj.onupdate();
	}
};

var Update_vars = function() {
	var perc;

	for ( var [key, value] of update_vars ) {
		var obj = var_objs[key];
		if ( !obj ) continue;

		update_var(obj, value);
	}
	update_vars.clear();
};

// width of percentage bar is about 28pt
var percentage_interval = Math.round(100/28);

var round_percentage = function(perc, step=1) {
	return Math.round(perc*100/step)*step
}

var paintCycleRef = null;
var do_check_upgrades_affordability = false;

export function bindPaintCycle(cycle) {
	paintCycleRef = cycle;
}

function flushAffordability() {
	if ( do_check_upgrades_affordability === true ) {
		window.check_upgrades_affordability();
		for ( var i = 0, l = ui.game.upgrade_objects_array.length, upgrade; i < l; i++ ) {
			upgrade = ui.game.upgrade_objects_array[i];

			if ( upgrade.affordableUpdated === true ) {
				if ( upgrade.affordable === true ) {
					upgrade.$el.classList.remove('unaffordable');
				} else {
					upgrade.$el.classList.add('unaffordable');
				}

				upgrade.affordableUpdated = false;
			}
		}
	}

	window.check_affordability();

	for ( var i = 0, l = ui.game.part_objects_array.length, part; i < l; i++ ) {
		part = ui.game.part_objects_array[i];

		if ( part.affordableUpdated === true ) {
			if ( part.affordable === true ) {
				part.$el.classList.remove('unaffordable', 'locked');
			} else {
				part.$el.classList.add('unaffordable');
			}

			part.affordableUpdated = false;
		}
	}
}

var update_interface = function() {
	window.updateProperty();
	Update_vars();
	flushAffordability();
};
ui.update_interface = update_interface;

/////////////////////////////
// Listen to app events
/////////////////////////////

var evts = {};

ui.say = function(type, name, val) {
	if ( type === 'var' ) {
		if ( val === current_vars.get(name) ) return;
		current_vars.set(name, val);
		update_vars.set(name, val);
	} else if ( type === 'evt' ) {
		if ( evts[name] ) {
			evts[name](val);
		}
	} else {
	}

	//console.log(arguments);
};

/////////////////////////////
// Events
/////////////////////////////

evts.tile_added = function(val) {
	var tile = val.tile;

	tile.$el = document.createElement('reactor-tile');
	tile.$el.tile = tile;
	tile.$el.style.gridRow = val.row + 1;
	tile.$el.style.gridColumn = val.column + 1;

	$reactor.appendChild(tile.$el);

	if (paintCycleRef && ui.game) {
		paintCycleRef.registerTile(tileIndex(tile, ui.game.max_cols), tile.$el);
	}
};

var $cells = $('#cells');
var $reflectors = $('#reflectors');
var $capacitors = $('#capacitors');
var $vents = $('#vents');
var $heat_exchangers = $('#heat_exchangers');
var $heat_inlets = $('#heat_inlets');
var $heat_outlets = $('#heat_outlets');
var $coolant_cells = $('#coolant_cells');
var $reactor_platings = $('#reactor_platings');
var $particle_accelerators = $('#particle_accelerators');

evts.part_added = function(val) {
	var part_obj = val;
	var part = part_obj.part;

	part_obj.className = 'part_' + part.id;
	part_obj.$el = document.createElement('BUTTON');
	part_obj.$el.classList.add('part', 'locked', part_obj.className);
	part_obj.$el._part = part_obj;

	var $image = $('<div class="image">');
	$image.textContent = 'Click to Select';

	part_obj.$el.appendChild($image);

	if ( part.category === 'cell' ) {
		$cells.appendChild(part_obj.$el);
	} else if ( part.category === 'reflector' ) {
		$reflectors.appendChild(part_obj.$el);
	} else if ( part.category === 'capacitor' ) {
		$capacitors.appendChild(part_obj.$el);
	} else if ( part.category === 'vent' ) {
		$vents.appendChild(part_obj.$el);
	} else if ( part.category === 'heat_exchanger' ) {
		$heat_exchangers.appendChild(part_obj.$el);
	} else if ( part.category === 'heat_inlet' ) {
		$heat_inlets.appendChild(part_obj.$el);
	} else if ( part.category === 'heat_outlet' ) {
		$heat_outlets.appendChild(part_obj.$el);
	} else if ( part.category === 'coolant_cell' ) {
		$coolant_cells.appendChild(part_obj.$el);
	} else if ( part.category === 'reactor_plating' ) {
		$reactor_platings.appendChild(part_obj.$el);
	} else if ( part.category === 'particle_accelerator' ) {
		$particle_accelerators.appendChild(part_obj.$el);
	}
};

// Tile height/width change
var adjust_primary_size_timeout;
var adjust_primary_size = function() {
	if ( !window.matchMedia('(min-width: 939px)').matches ) return;

	var original_display = $reactor_section.style.display;
	$reactor_section.style.display = 'inherit';
	$primary.style.width = '';
	$primary.style.width = $reactor_section.offsetWidth + 32 + 'px';
	$reactor_section.style.display = original_display;
};

evts.tile_disabled = function(tile) {
	tile.$el.classList.remove('enabled');

	clearTimeout(adjust_primary_size_timeout);
	adjust_primary_size_timeout = setTimeout(adjust_primary_size, 10);
};

evts.tile_enabled = function(tile) {
	tile.$el.classList.add('enabled');

	clearTimeout(adjust_primary_size_timeout);
	adjust_primary_size_timeout = setTimeout(adjust_primary_size, 10);
};

// Game

evts.game_inited = function() {
	syncGridDimensions(ui.game);
	ui.update_interface();
}

evts.game_loaded = function() {
	syncGridDimensions(ui.game);
	$parts.scrollTop = $parts.scrollHeight;
};

evts.game_updated = function() {
	_show_page('reactor_upgrades', 'patch_section', true);
};

// Objectives

var $objectives_section = $('#objectives_section');
var objective_timeout;

var $objective_title = $('#objective_title');
var $objective_reward = $('#objective_reward');

evts.objective_unloaded = function() {
	$objectives_section.classList.add('unloading');
};

evts.objective_loaded = function(val) {
	$objectives_section.classList.add('loading');
	$objective_title.textContent = val.title;
	if ( val.reward ) {
		$objective_reward.textContent = '$' + fmt(val.reward);
	} else if ( val.ep_reward ) {
		$objective_reward.textContent = fmt(val.ep_reward) + 'EP';
	} else {
		$objective_reward.textContent = '';
	}
	$objectives_section.classList.remove('unloading');

	clearTimeout(objective_timeout);
	objective_timeout = setTimeout(function() {
		$objectives_section.classList.remove('loading');
	}, 100);
};

/////////////////////////////
// Reboot
/////////////////////////////

$('#reboot').onclick = async function(event) {
	event.preventDefault();

	if ( !(await confirmDialog('Are you sure?', { title: 'Reboot' })) ) return;

	reboot();
};

$('#refund').onclick = async function(event) {
	event.preventDefault();

	if ( !(await confirmDialog('Are you sure?', { title: 'Refund' })) ) return;

	reboot(true);
};

/////////////////////////////
// Reduce Heat Manually
/////////////////////////////

$('#reduce_heat').onclick = function(event) {
	event.preventDefault();

	window.manual_reduce_heat();
};

/////////////////////////////
// Toggle UI
/////////////////////////////

var toggleApi = initToggles(ui, $main, $reactor);
Object.assign(evts, toggleApi.events);

ui.toggle_buttons_saves = toggle_buttons_saves;
ui.toggle_buttons_loads = toggle_buttons_loads;

/////////////////////////////
// Misc UI
/////////////////////////////

//Sell
$('#sell').onclick = function(event) {
	event.preventDefault();

	window.sell();
};

var $power_indicator = $('#power_indicator');
if ( $power_indicator ) {
	$power_indicator.onclick = function(event) {
		if ( !window.matchMedia('(max-width: 938px)').matches ) return;

		event.preventDefault();
		window.sell();
	};
}

// Save
$('#trigger_save').onclick = async function() {
	ui.game.save_manager.active_saver.save(ui.game.saves());
	await alertDialog('Game saved', { title: 'Save' });
}

$('#download_save').onclick = function() {
	var save_data = ui.game.saves();
	ui.game.save_manager.active_saver.save(save_data);
	var saveAsBlob = new Blob([ save_data ], { type: 'text/plain' });
	var downloadLink = document.createElement("a");

	downloadLink.download = "reactor_knockoff_save.base64";
	downloadLink.textContent = "Download File";
	downloadLink.href = URL.createObjectURL(saveAsBlob);
	downloadLink.onclick = (event) => {
		// clean up blob after the browser get it
		setTimeout(URL.revokeObjectURL, 100, event.target.href);
		document.body.removeChild(event.target)
	};
	downloadLink.style.display = "none";
	document.body.appendChild(downloadLink);

	downloadLink.click();
};

$('#export_save').onclick = function() {
	var save_data = ui.game.saves();
	ui.game.save_manager.active_saver.save(save_data);
	$('#import_button').style.display = "none";
	$("#txtImportExport").value = save_data;
	$("#txtImportExport").select();
	blockGameForModal();
	$("#Import_Export_dialog").showModal();
};

$('#import_save').onclick = function() {
	$('#import_button').style.display = null;
	$("#txtImportExport").value = "";
	blockGameForModal();
	$("#Import_Export_dialog").showModal();
};

$('#import_button').onclick = function() {
	ui.game.loads($("#txtImportExport").value);
	$("#txtImportExport").value = "";
};

$('#reset_game').onclick = async function() {
	if ( !(await confirmDialog('confirm reset game?', { title: 'Reset Game', confirmLabel: 'Reset' })) ) return;
	ui.game.save_manager.active_saver.save("");
	document.location.reload();
}

$('#Import_Export_close_button').onclick = function() {
	$('#Import_Export_dialog').close();
	unblockGameForModal();
}

$('#Import_Export_dialog').addEventListener('close', function() {
	unblockGameForModal();
});

/////////////////////////////
// Pure UI
/////////////////////////////

// Show Pages
var _show_page = function(section, id) {
	var $page = $('#' + id);
	var $section = $('#' + section);
	var pages = $section.getElementsByClassName('page');

	for ( var i = 0, length = pages.length, $p; i < length; i++ ) {
		$p = pages[i];
		$p.classList.remove('showing')
	}

	$page.classList.add('showing');

	if ( $page_nav ) {
		var navButtons = $page_nav.querySelectorAll('.nav');
		for ( var j = 0; j < navButtons.length; j++ ) {
			var btn = navButtons[j];
			if ( btn.getAttribute('data-page') === id ) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		}
	}

	if ( id == 'upgrades_section' || id == 'experimental_upgrades_section' ) {
		do_check_upgrades_affordability = true;
	} else {
		do_check_upgrades_affordability = false;
	}

	if ( id === 'reactor_section' ) {
		$main.classList.add('reactor_showing');
	} else {
		$main.classList.remove('reactor_showing');
	}

	syncMobilePartsDrawer($main);
};

$main.delegate('nav', 'click', function(event) {
	if ( event ) {
		event.preventDefault();
	}

	var id = this.getAttribute('data-page');
	var section = this.getAttribute('data-section');
	_show_page(section, id);
});

// TODO: Save preference
// Stats more/less
create_toggle_button('#more_stats_toggle', '[+]', '[-]')(
	()=>$main.classList.contains('show_more_stats'),
	function() {
		$main.classList.remove('show_more_stats');
		update_button('#more_stats_toggle')();
	},
	function() {
		$main.classList.add('show_more_stats');
		update_button('#more_stats_toggle')();
	}
);
update_button('#more_stats_toggle')();

var $parts_drawer_toggle = $('#parts_drawer_toggle');
if ( $parts_drawer_toggle ) {
	$main.classList.add('parts_expanded');
	$parts_drawer_toggle.onclick = function(event) {
		event.preventDefault();
		event.stopPropagation();
		if ( $main.classList.contains('part_active') ) return;
		$main.classList.toggle('parts_expanded');
		$parts_drawer_toggle.textContent = $main.classList.contains('parts_expanded') ? '\u9660' : '\u9650';
		syncMobilePartsDrawer($main);
	};
	syncMobilePartsDrawer($main);
	window.addEventListener('resize', () => syncMobilePartsDrawer($main));
}

// Show spoilers
$('#help_section').delegate('show_spoiler', 'click', function() {
	var has_spoiler = this;
	var found = false;

	while ( has_spoiler ) {
		if ( has_spoiler.classList.contains('has_spoiler') ) {
			found = true;
			break;
		} else {
			has_spoiler = has_spoiler.parentNode;
		}
	}

	if ( !found ) {
		return;
	}

	has_spoiler.classList.toggle('show');
});

