import { addProperty, updateProperty } from './properties.js';

export { addProperty, updateProperty };

if (typeof Element !== 'undefined') {
  Element.prototype.delegate = function(className, type, fn) {
    var $self = this;

    var onfn = function(event = window.event) {
      var $target = event.target || event.srcElement;

      while ($target != $self) {
        if ($target.classList.contains(className)) {
          event.preventDefault();
          return fn.call($target, event);
        }

        $target = $target.parentNode;
      }
    };

    if (type === 'focus' || type === 'blur') {
      this.addEventListener(type, onfn, true);
    } else {
      this['on' + type] = onfn;
    }
  };
}

var _div = typeof document !== 'undefined' ? document.createElement('div') : null;

export function $(a1) {
  if (typeof a1 === 'string') {
    if (a1.match(/^<.+>$/)) {
      _div.innerHTML = a1;
      return _div.firstChild;
    } else if (a1.match(/^#[^ ]+$/)) {
      return document.getElementById(a1.substring(1));
    }
  }
}

var cm_names = ('K M B T Qa Qi Sx Sp Oc No Dc').split(' ');

var pow;
var fnum;
var find_exponent = /(([1-9])(\.([0-9]+))?)e\+([0-9]+)/;
var fmt_parts;
var floor_num;

export function fmt(num, places = null) {
  num = Number(num);
  if (!Number.isFinite(num)) num = 0;
  floor_num = Math.floor(num).toString();

  if (places !== null) {
    pow = Math.floor((floor_num.length - 1) / 3) * 3;
    num = Math.round(num / Math.pow(10, pow - places)) * Math.pow(10, pow - places);
  }

  if ((fmt_parts = floor_num.match(find_exponent))) {
    places = places || 3;

    if (fmt_parts[5] > 35) {
      fnum = fmt_parts[2] + (fmt_parts[3] ? fmt_parts[3].substring(0, places + 1) : '') + 'e' + fmt_parts[5];
    } else if (fmt_parts[3]) {
      num = fmt_parts[2] + fmt_parts[4] + '00';
      fnum = parseFloat(num.substring(0, (fmt_parts[5] % 3) + 1) + '.' + num.substring((fmt_parts[5] % 3) + 1, (fmt_parts[5] % 3) + places + 1)) + cm_names[Math.floor(fmt_parts[5] / 3) - 1];
    } else {
      num = fmt_parts[2] + '00';
      fnum = num.substring(0, (fmt_parts[5] % 3) + 1) + cm_names[Math.floor(fmt_parts[5] / 3) - 1];
    }
  } else {
    pow = Math.floor((floor_num.length - 1) / 3) * 3;
    fnum = (Math.floor(num / Math.pow(10, pow - 3)) / Math.pow(10, 3)) + (pow === 0 ? '' : cm_names[(pow / 3) - 1]);
  }

  return fnum;
}

if (typeof window !== 'undefined') {
  window.performance = window.performance || {};
  performance.now = (function() {
    return performance.now ||
      performance.mozNow ||
      performance.msNow ||
      performance.oNow ||
      performance.webkitNow ||
      function() { return new Date().getTime(); };
  })();

  window.$ = $;
  window.fmt = fmt;
  window.addProperty = addProperty;
  window.updateProperty = updateProperty;
}
