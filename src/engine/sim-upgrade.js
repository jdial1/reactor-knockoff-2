export class SimUpgrade {
  constructor(upgrade, game) {
    this.max_level = upgrade.levels || game.upgrade_max_level;
    this.upgrade = upgrade;
    this.level = 0;
    this.cost = 0;
    this.part = upgrade.part || null;
    this.erequires = upgrade.erequires || null;
    this.ecost = upgrade.ecost || 0;
    this.affordable = true;
  }

  setLevel(level) {
    this.level = level;

    if (this.ecost) {
      if (this.upgrade.multiplier) {
        this.ecost = this.upgrade.ecost * Math.pow(this.upgrade.multiplier, this.level);
      } else {
        this.ecost = this.upgrade.ecost;
      }
    } else {
      this.cost = this.upgrade.cost * Math.pow(this.upgrade.multiplier, this.level);
    }

    if (this.upgrade.onclick) {
      this.upgrade.onclick(this);
    }
  }

  setAffordable(value) {
    this.affordable = value;
  }
}
