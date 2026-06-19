let enabled = true;

const PATTERNS = {
  placement: [15],
  deplete: [10, 30, 10],
  meltdown: [80, 40, 120],
  error: [30, 20, 30],
};

export function hapticsEnabled() {
  return enabled;
}

export function setHapticsEnabled(value) {
  enabled = !!value;
}

export function haptic(type) {
  if (!enabled || !('vibrate' in navigator)) return;
  const pattern = PATTERNS[type];
  if (pattern) {
    navigator.vibrate(pattern);
  }
}
