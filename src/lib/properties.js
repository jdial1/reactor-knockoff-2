const property_buffer = new Map();

export function addProperty(name, value) {
  this[name] = value;
  this[name + 'Updated'] = true;

  this['set' + name.charAt(0).toUpperCase() + name.slice(1)] = (val) => {
    if (val !== this[name]) {
      this[name] = val;
      property_buffer.set(this, [name, val]);
    }
  };
}

export function updateProperty() {
  for (const [tile, [name, value]] of property_buffer) {
    if (value !== tile[name + 'Last']) {
      tile[name + 'Last'] = value;
      tile[name + 'Updated'] = true;
    }
  }

  property_buffer.clear();
}
