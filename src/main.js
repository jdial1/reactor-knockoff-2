import './lib/compat.js';
import './lib/globals.js';
import './ui/reactor-tile.js';
import { preloadGameIcons } from './ui/preload-assets.js';
import ui from './ui/app-ui.js';
import { save_manager } from './save/save-manager.js';
import { initGame } from './game/init.js';

preloadGameIcons();

initGame(ui, save_manager).catch((err) => {
  console.error('initGame failed:', err);
  window.__initError = err?.stack || String(err);
});
