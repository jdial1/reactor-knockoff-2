export function attachPartTooltipMethods(Part, game, fmt, getTransferMultiplier, getVentMultiplier, $, singleCellDescription, multiCellDescription) {
  var $tooltip_name = $('#tooltip_name');
  var $tooltip_description = $('#tooltip_description');
  var $tooltip_cost = $('#tooltip_cost');
  var $tooltip_sells_wrapper = $('#tooltip_sells_wrapper');
  var $tooltip_sells = $('#tooltip_sells');
  var $tooltip_heat_per = $('#tooltip_heat_per');
  var $tooltip_power_per = $('#tooltip_power_per');
  var $tooltip_heat_per_wrapper = $('#tooltip_heat_per_wrapper');
  var $tooltip_power_per_wrapper = $('#tooltip_power_per_wrapper');
  var $tooltip_heat_wrapper = $('#tooltip_heat_wrapper');
  var $tooltip_heat = $('#tooltip_heat');
  var $tooltip_max_heat = $('#tooltip_max_heat');
  var $tooltip_ticks_wrapper = $('#tooltip_ticks_wrapper');
  var $tooltip_ticks = $('#tooltip_ticks');
  var $tooltip_max_ticks = $('#tooltip_max_ticks');
  var $tooltip_chance_wrapper = $('#tooltip_chance_wrapper');
  var $tooltip_chance = $('#tooltip_chance');
  var $tooltip_chance_percent_of_total = $('#tooltip_chance_percent_of_total');

  const engineUpdateDescription = Part.prototype.updateDescription;

  Part.prototype.updateDescription = function(tile) {
    engineUpdateDescription.call(
      this,
      tile,
      game,
      fmt,
      singleCellDescription,
      multiCellDescription,
      getTransferMultiplier(),
      getVentMultiplier()
    );
  };

  Part.prototype.showTooltip = function(tile) {
    $tooltip_name.textContent = this.part.title;

    if (tile) {
      this.updateDescription(tile);
      $tooltip_cost.style.display = 'none';

      if (tile.activated && tile.part.containment) {
        $tooltip_heat_wrapper.style.display = null;
      } else {
        $tooltip_heat_wrapper.style.display = 'none';
      }

      if (tile.activated && tile.part.ticks) {
        $tooltip_ticks_wrapper.style.display = null;
      } else {
        $tooltip_ticks_wrapper.style.display = 'none';
      }

      if (tile.activated && tile.part.heat) {
        $tooltip_heat_per_wrapper.style.display = null;
      } else {
        $tooltip_heat_per_wrapper.style.display = 'none';
      }

      if (tile.activated && tile.part.power) {
        $tooltip_power_per_wrapper.style.display = null;
      } else {
        $tooltip_power_per_wrapper.style.display = 'none';
      }

      if (tile.activated && tile.part.power) {
        $tooltip_power_per_wrapper.style.display = null;
      } else {
        $tooltip_power_per_wrapper.style.display = 'none';
      }

      if (tile.activated && tile.part.category === 'cell') {
        $tooltip_sells_wrapper.style.display = 'none';
      } else {
        $tooltip_sells_wrapper.style.display = null;
      }

      if (tile.activated && tile.part.category === 'particle_accelerator') {
        $tooltip_chance_wrapper.style.display = null;
      } else {
        $tooltip_chance_wrapper.style.display = 'none';
      }
    } else {
      this.updateDescription();
      $tooltip_cost.style.display = null;
      $tooltip_sells_wrapper.style.display = 'none';

      $tooltip_heat_wrapper.style.display = 'none';
      $tooltip_ticks_wrapper.style.display = 'none';

      $tooltip_heat_per_wrapper.style.display = 'none';
      $tooltip_power_per_wrapper.style.display = 'none';

      $tooltip_chance_wrapper.style.display = 'none';
    }

    this.updateTooltip(tile);
  };

  Part.prototype.updateTooltip = function(tile) {
    if (tile) {
      if ($tooltip_description.textContent !== tile.part.description) {
        $tooltip_description.textContent = tile.part.description;
      }

      if (tile.activated && tile.part.containment) {
        $tooltip_heat.textContent = fmt(tile.heat_contained);
        $tooltip_max_heat.textContent = fmt(tile.part.containment);
      }

      if (tile.activated && tile.part.ticks) {
        $tooltip_ticks.textContent = fmt(tile.ticks);
        $tooltip_max_ticks.textContent = fmt(tile.part.ticks);
      }

      if (tile.activated && tile.part.heat) {
        $tooltip_heat_per.textContent = fmt(tile.display_heat);
      }

      if (tile.activated && tile.part.power) {
        $tooltip_power_per.textContent = fmt(tile.display_power);
      }

      if (tile.activated && tile.part.category !== 'cell') {
        if (tile.part.ticks) {
          $tooltip_sells.textContent = fmt(Math.ceil(tile.ticks / tile.part.ticks * tile.part.cost));
        } else if (tile.part.containment) {
          $tooltip_sells.textContent = fmt(tile.part.cost - Math.ceil(tile.heat_contained / tile.part.containment * tile.part.cost));
        } else {
          $tooltip_sells.textContent = fmt(tile.part.cost);
        }
      }

      if (tile.activated && tile.part.category === 'particle_accelerator') {
        $tooltip_chance.textContent = fmt(tile.display_chance);
        $tooltip_chance_percent_of_total.textContent = fmt(tile.display_chance_percent_of_total);
      }
    } else {
      $tooltip_description.textContent = this.description;

      if (this.erequires && !game.upgrade_objects[this.erequires].level) {
        $tooltip_cost.textContent = 'LOCKED';
      } else {
        $tooltip_cost.textContent = fmt(this.cost);
      }
    }
  };
}
