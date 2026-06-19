# Reactor Knockoff — Design Principles & Modernization Guide

This document captures what this project *is*, how it is built, and which ideals must survive a UI modernization. It is derived from the current codebase: a single-page incremental reactor game (v1.3.2) forked from [Reactor Incremental](http://www.kongregate.com/games/Cael/reactor-incremental), with sci-fi UI assets by [Buch](http://opengameart.org/content/sci-fi-user-interface-elements).

The recommended modernization path is **Vanilla-First**: leverage ES2022+ and modern Browser APIs to achieve framework-grade ergonomics without virtual DOM overhead, honoring the original author's close-to-the-metal performance intent.

---

## Table of Contents

1. [Core Ideals (Non-Negotiables)](#1-core-ideals-non-negotiables)
2. [Technical Architecture](#2-technical-architecture)
3. [UI Structure & Information Architecture](#3-ui-structure--information-architecture)
4. [Visual Design System](#4-visual-design-system)
5. [Interaction Design](#5-interaction-design)
6. [Game Simulation Architecture](#6-game-simulation-architecture)
7. [Performance Philosophy](#7-performance-philosophy)
8. [Modernization Principles](#8-modernization-principles)
9. [Vanilla-First Architecture Blueprint](#9-vanilla-first-architecture-blueprint)
   - [9.8 Anti-Patterns & Anti-Roadmap](#98-anti-patterns--anti-roadmap)
10. [Suggested Modern Design System Mapping](#10-suggested-modern-design-system-mapping)
11. [File Reference Map](#11-file-reference-map)
12. [Modernization Roadmap](#12-modernization-roadmap)
13. [Summary](#13-summary)

---

## 1. Core Ideals (Non-Negotiables)

These are the identity of the game. Any redesign should preserve them even if every pixel changes.

### 1.1 The Core Loop

```
Cells → Power + Heat → Sell Power → Money → Bigger Parts / Upgrades → More Power
                                              ↓
                              Particle Accelerators → Exotic Particles (EP)
                                              ↓
                              Experimental Upgrades → Reboot (prestige) → Repeat
```

Heat is not just a number — it is a **risk/reward axis**. High heat enables Forceful Fusion bonuses; uncontrolled heat causes component explosions and full reactor meltdown.

### 1.2 Spatial Puzzle, Not Just a Spreadsheet

The reactor is a **grid of 32×32px tiles** (starting 14×11, expandable via upgrades). Adjacency matters:

- Reflectors boost adjacent cells
- Vents, exchangers, inlets, and outlets manage heat flow between tiles and the global reactor heat pool
- Particle accelerators require deliberate heat routing (in → accelerator → out)

Layout optimization is the primary skill expression. The UI must always foreground the grid as the central canvas.

### 1.3 Incremental Honesty

- Numbers grow exponentially; display uses compact notation (`K`, `M`, `B`, … via `fmt()`)
- Per-tick deltas are shown alongside totals (`last tick` values for heat, power, money)
- Upgrades have visible levels, escalating costs, and clear mechanical descriptions
- Objectives guide early progression with cash/EP rewards

### 1.4 Player Agency Through Toggles

The game exposes many **binary control toggles** that change behavior without hiding complexity:

| Toggle | Effect |
|--------|--------|
| Pause | Stops tick loop |
| Auto Sell / Auto Buy | Automation of economy and replenishment |
| Heat Controller | Alters passive heat venting behavior |
| Time Flux | Accelerates catch-up ticks using offline accumulated time |
| Manual Sell / Reduce Heat | Active player interventions |

Modern UI should make these states obvious (on/off, consequences visible) without removing them.

### 1.5 Prestige With Memory

Rebooting is a deliberate reset:

- **Standard reboot**: Clears parts, money, regular upgrades; keeps experimental (EP) upgrades; banks EP
- **Refund reboot**: Also resets experimental upgrades and refunds all accumulated EP

This dual-path prestige is a core long-term loop. It must remain distinct and clearly explained.

---

## 2. Technical Architecture

### 2.1 Stack Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Markup | Static HTML (`index.html`) | Semantic regions, stable element IDs |
| Style | Plain CSS (4 files) | Layout, sci-fi chrome, performance layers |
| Logic | Vanilla ES6-ish JS (IIFEs, no bundler) | Game sim, UI binding, save, hotkeys |
| Assets | PNG/GIF sprites, 9-slice borders | Pixel-art component and chrome visuals |
| Persistence | localStorage + optional Google Drive | Base64-encoded save blobs |

There is no framework, no build step, and no component system. Everything is **ID-driven imperative DOM**.

### 2.2 Module Boundaries

Scripts load in dependency order:

```
app.compat.js   → Polyfills, $(), fmt(), addProperty(), delegate()
app.globals.js  → Shared utilities (property buffer, updateProperty)
app.parts.js    → window.parts[] data definitions
app.upgrades.js → window.upgrades(game) factory
app.objectives.js → window.objectives(game) factory
app.ui.js       → UI singleton, DOM binding, events, page nav
app.upgrade.js  → Upgrade class
app.save.js     → LocalSaver / GoogleSaver
app.hotkeys.js  → Bulk placement macros
app.js          → Game class, tick loop, tiles, parts, main logic
```

**Separation pattern:**

- **Data** lives in `parts.js`, `upgrades.js`, `objectives.js` as declarative arrays
- **Simulation** lives in `app.js` (`Game`, `Tile`, `Part`, `_game_loop`)
- **Presentation** lives in `app.ui.js`, driven by `ui.say('var' | 'evt', ...)`
- **Persistence** is decoupled via `save_manager`

This is a clean modernization seam: simulation can be extracted without rewriting mechanics.

### 2.3 State Management Pattern

The game uses a **pub/sub bridge** between logic and UI:

```javascript
// Game logic announces changes:
ui.say('var', 'current_money', game.current_money);
ui.say('evt', 'tile_added', { row, tile });

// UI batches DOM updates every 100ms:
update_interface() → Update_vars() + tile percent bars + affordability classes
```

Tile/part properties use `addProperty()` with a **dirty-flag buffer** (`property_buffer`) so multiple writes per tick coalesce into one DOM update. This is a deliberate performance design — any modern renderer should preserve batched, dirty-checked updates for the reactor grid.

### 2.4 DOM Contract

The HTML defines a **stable ID schema** that JS depends on:

- **Stats**: `#current_heat`, `#max_heat`, `#heat_percentage`, `#money`, etc.
- **Reactor**: `#reactor` → rows of `.tile` buttons
- **Parts palette**: `#parts` → category menus (`#cells`, `#vents`, …)
- **Pages**: `.page` sections inside `#reactor_upgrades`, toggled via `.showing`
- **Tooltip**: `#tooltip_*` fields populated on hover/focus

Modernization can restructure markup **only if** these binding points (or an adapter layer) are preserved.

### 2.5 Key Classes & Data Structures

| Class / Object | File | Role |
|----------------|------|------|
| `Game` | `app.js` | Global game state, grid dimensions, toggles |
| `Tile` | `app.js` | Grid cell: part reference, heat, ticks, adjacency lists |
| `Part` | `app.js` | Runtime part instance with computed stats and tooltip |
| `Upgrade` | `app.upgrade.js` | Upgrade instance with level, cost, DOM element |
| `UI` | `app.ui.js` | DOM bridge, toggle buttons, page navigation |

Parts are defined declaratively in `app.parts.js` and instantiated at runtime. Upgrades are factory-generated in `app.upgrades.js` with `onclick` hooks that mutate game state directly.

---

## 3. UI Structure & Information Architecture

### 3.1 Layout Regions

```
┌─────────────────────────────────────────────────────────────┐
│  #main (flex row)                                           │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │  #secondary  │  │  #primary                            │ │
│  │              │  │  ┌─ #tooltip_nav (nav + tooltip) ───┐ │ │
│  │  #stats      │  │  ├─ #objectives_section ───────────┤ │ │
│  │  _section    │  │  └─ #reactor_upgrades ─────────────┘ │ │
│  │              │  │       (reactor / upgrades / help /     │ │
│  │  #parts      │  │        options / about / patch)       │ │
│  │  _section    │  │                                      │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Design intent:**

- **Left sidebar (`#secondary`, 261px fixed)**: Always-visible economy + parts palette
- **Right main (`#primary`)**: Contextual workspace — nav, objectives strip, primary page content
- **Reactor is the default page**; upgrades/help/options are alternate views in the same panel

### 3.2 Page Navigation Model

Navigation uses `.nav` buttons with `data-section` + `data-page` attributes. `_show_page()` hides all `.page` siblings and adds `.showing` to the target.

| Page ID | Purpose |
|---------|---------|
| `reactor_section` | Grid + reactor stats bar |
| `upgrades_section` | Money-purchased upgrades |
| `experimental_upgrades_section` | EP upgrades + reboot controls |
| `help_section` | Tutorial + spoiler content |
| `options_section` | Save/load, dev toggles |
| `about_section` / `patch_section` | Attribution + changelog |

**Core ideal:** One panel, multiple views — not separate routes or modals for primary gameplay. Modernization should keep reactor one click away.

### 3.3 Tooltip as Context Panel

The tooltip is not a floating popover — it **replaces the nav bar** when active:

```css
#main.tooltip_showing #nav { display: none; }
```

It serves dual modes:

1. **Part palette hover**: Shows cost, stats, description for unplaced parts
2. **Tile focus**: Shows live durability, contained heat, sell value, EP chance

On touch/mobile (`.touch` class), tooltip becomes fixed-position overlay; nav stays visible.

**Preserve:** Contextual inspection without leaving the reactor view. A modern design might use a side drawer or bottom sheet, but the information density and dual-mode behavior should remain.

### 3.4 Objectives Strip

A compact horizontal bar between nav and reactor:

- Title left, reward right (monospace)
- Completion animation: green flash → slide-out → slide-in (`loading` / `unloading` classes)

Objectives are sequential, check-based milestones — the strip is always visible during play to anchor early progression.

### 3.5 Stats Panel

The stats section (`#stats_section`) displays the three core resources:

| Section | Key Elements | Visual |
|---------|-------------|--------|
| Heat | `#current_heat` / `#max_heat`, `#heat_per_tick`, `#reduce_heat` button | Red fill bar (`#heat_percentage`) |
| Power | `#current_power` / `#max_power`, `#power_per_tick`, `#sell` button | Cyan fill bar (`#power_percentage`) |
| Currency | `#money`, `#money_per_tick`, EP/TF counters | Green background (`#currency`) |

Section headings use `.heading` with a colon suffix (`:after { content: ":" }`). Many headings are hidden on desktop but exposed on mobile with rotated labels.

---

## 4. Visual Design System

### 4.1 Aesthetic Identity: Retro Sci-Fi Control Panel

The UI is built around **9-slice border-image chrome**, not flat modern panels:

- Outer connector frame: `#main:before` with `connector_border.png`
- Panel variants: `panel_border_first_first.png`, `panel_border_last_last.png`, etc.
- Inner content wells: `inner_border.png` on `.subpanel`
- Buttons: `small_button_off.png` / `small_button_on.png` / `small_button_down.png` via `border-image`

Background: near-black `#000204`. Panel fills: `#485667`, `#222C38`. This is a **dark industrial HUD**, not a light material dashboard.

### 4.2 Semantic Color Mapping

These colors encode game state and must remain semantically consistent even if hues shift:

| Color | Hex (approx) | Meaning |
|-------|-------------|---------|
| Green | `#59c435` | Money bar, active selection, cell durability bars — safe / selected / income |
| Cyan | `#33a5c6` | Power fill bar — stored energy |
| Red | `#f00` | Heat fill bar, heat containment bars, meltdown overlay — danger / thermal |
| Blue-gray | `#76809b` | Default button chrome — neutral controls |
| Dark slate | `#222C38` | Subpanels, stat backgrounds — data wells |
| Link | `#d3f5f6` | Anchor text |
| Visited link | `#c3a5f6` | Visited anchor text |

**Active selection** (part or tile): green 1px box-shadow + green background — universal "selected tool" indicator.

**Unaffordable**: 50% opacity on part/upgrade images (`.unaffordable`).

**Spent cells**: CSS grayscale filter (`.spent`).

**Overheating reactor**: `#reactor_background` red overlay scales with `(current_heat - max_heat) / max_heat`.

### 4.3 Typography

| Context | Font | Notes |
|---------|------|-------|
| Stats, numbers, rewards | Monospace, bold | High legibility for changing values |
| Buttons, nav | Monospace 13.5px | Pixel-crisp with `text-shadow: 1px 1px 0 #000` |
| Body/help text | Arial/sans-serif 0.875em | Readable prose in `.explanitory` and `.cms` areas |
| Headings | Sans-serif 18px | Light weight, heavy shadow |

Numbers use **outline text-shadow** (8-direction black stroke) for readability over fill bars.

### 4.4 Grid & Tile Visual Language

- Base tile: 32×32px, `tile.png` background (spaced repeat on `#reactor`)
- Component art: CSS `background-image` per part class (`.part_uranium1`, etc.)
- Durability (cells/reflectors): **green** 2px bar at bottom
- Heat containment (vents, capacitors, etc.): **red** 2px bar at bottom
- Explosion: stepped GIF animation (`.exploding`, `@keyframes explosion`)
- Percent bars update in **quantized steps** (~28px width → ~3.5% increments) to reduce repaint cost

The grid is **dense and pixel-aligned**. Modernization should not inflate tile size without recalculating layout math (`adjust_primary_size()` ties primary width to reactor dimensions).

### 4.5 Reactor Stats Bar

Above the grid, `#reactor_stats` shows estimated per-tick values with icon prefixes:

| Stat ID | Icon | Meaning |
|---------|------|---------|
| `#stats_vent` | `icon_vent.gif` | Estimated total heat venting per tick |
| `#stats_inlet` | `icon_inlet.gif` | Total potential heat inletting per tick |
| `#stats_outlet` | `icon_outlet.gif` | Total potential heat outletting per tick |
| `#stats_heat` | `icon_heat.gif` | Estimated heat generation per tick |
| `#stats_power` | `icon_power.gif` | Estimated power generation per tick |
| `#stats_cash` | `icon_cash.gif` | Estimated autosell cash per tick |

Each stat is a monospace right-aligned value in a dark subpanel with a 16×16 icon on the left.

### 4.6 CMS Content Styling

Help, about, options, and patch notes use `.cms` class with normalized HTML typography (`cms.css`). This isolates prose content from game chrome — a good pattern to keep for long-form text in a modern design system.

Spoiler content in help uses `.has_spoiler` / `.show_spoiler` toggle pattern.

---

## 5. Interaction Design

### 5.1 Part Placement Flow

1. Click part in palette → `.part_active` on button, `#main.part_active` on mobile (collapses palette to selected part only)
2. Click/hover reactor tile → places part (deducts money, activates tile)
3. Right-click / modifier interactions sell or bulk-manipulate

**Replacement rules:** Same-category parts can replace in-place; depleted cells can be swapped; partial refunds calculated from remaining ticks.

**Tile queue:** Clicks on unaffordable tiles queue placement; queue drains as money arrives per tick.

### 5.2 Bulk Editing Hotkeys

Hold modifiers + click/drag on tiles:

| Modifier | Action |
|----------|--------|
| Ctrl | Fill row |
| Alt | Fill column |
| Shift | Ignore part-type filter |
| Number 2–9 | Spacing stride |
| Ctrl+Alt+Shift | Checkerboard fill |

These are power-user features central to late-game layout management. Modern UI should expose them (tooltip hints, modifier badges) rather than drop them.

### 5.3 Toggle Buttons

Implemented via `create_toggle_button()` — label inverts based on state (`Pause` ↔ `Unpause`). State persists in save data (`buttons_state`).

Toggle buttons include:

- `#pause_toggle`
- `#auto_sell_toggle` / `#auto_buy_toggle`
- `#heat_control_toggle`
- `#time_flux_toggle`
- `#speed_hack` (dev/perf option)
- `#offline_tick` (dev option)
- `#more_stats_toggle` (`[+]` / `[-]` for expanded stats on mobile)

Modernization: use clear toggle/switch components, but keep **explicit text labels** (not icon-only) since labels carry mechanical meaning.

### 5.4 Touch Adaptations

`app.legacy.css` (938px breakpoint — present in repo but **not linked** in `index.html`) defines mobile behavior:

- Fixed stats bar at top (`position: fixed; z-index: 10`)
- Collapsed parts drawer when part selected (`#main.part_active #parts_section`)
- Fixed tooltip overlay
- Hidden per-tick stats unless `[+]` expanded (`#main.show_more_stats`)
- Parts palette hides all but active part when placing

Any responsive redesign should implement equivalent **space-constrained workflows**, especially: stats always visible, parts collapsible, reactor maximized.

### 5.5 Save / Options Interactions

Options page provides:

- Google Drive online save / local save only
- Manual save, export, download, import, reset
- Import/export via native `<dialog>` element (`#Import_Export_dialog`)
- Speed hack and offline tick dev toggles

Current feedback uses native `alert()` and `confirm()` — prime candidates for in-game dialog modernization.

---

## 6. Game Simulation Architecture

### 6.1 Tick Loop

- Base interval: `1000ms / (chronometer level + 1)` (`game.base_loop_wait`)
- `game_loop()` schedules `_game_loop()` via `setTimeout` (not `requestAnimationFrame`)
- Time Flux: when behind real-time (`amount_of_ticks > 1`), loop interval drops to 10ms for catch-up
- Pause stops scheduling; unpause resumes

Each tick processes in order:

1. Cell power/heat generation, reflector pulses, depletion
2. Heat into containment parts
3. EP generation from particle accelerators
4. Heat inlets → reactor
5. Heat exchangers (balance by percentage)
6. Heat outlets → adjacent parts
7. Passive/auto heat reduction
8. Forceful Fusion power multiplier
9. Tile queue purchases
10. Venting, extreme vent power cost, PA6 heat injection
11. Containment overflow → explosion or perpetual replacement
12. Auto-sell
13. Meltdown check (`heat > 2× max_heat` or PA explosion)

### 6.2 Heat System

Three heat layers interact:

| Layer | Scope | Behavior |
|-------|-------|----------|
| Reactor heat | Global (`game.current_heat`) | Generated by cells/inlets; reduced by outlets, passive venting, manual reduce |
| Tile heat | Per-tile (`tile.heat`) | Generated by adjacent cells each tick |
| Contained heat | Per-part (`tile.heat_contained`) | Stored in capacitors, vents, coolant cells, etc.; overflow causes explosion |

Heat transfer components:

- **Inlets**: Pull heat from adjacent containment → reactor
- **Exchangers**: Balance heat by percentage among adjacent parts
- **Outlets**: Push reactor heat → adjacent containment
- **Vents**: Remove contained heat each tick (extreme vent consumes power)

### 6.3 Meltdown

Catastrophic failure triggers when:

- Any particle accelerator exceeds containment, or
- Reactor heat exceeds `2 × max_heat`

Effects:

- All parts explode with animation
- `game.has_melted_down = true`
- Auto-save triggered
- UI receives `melting_down` state via `ui.say`

The reactor **red flash** (`#reactor_background`) precedes total loss. This is a core tension mechanic — UI must communicate proximity to meltdown clearly.

### 6.4 Progression Layers

| Layer | Currency | Resets on Reboot? |
|-------|----------|-------------------|
| Parts on grid | Money | Yes |
| Regular upgrades | Money | Yes |
| Experimental upgrades | EP | No (unless refund reboot) |
| EP bank | EP | Accumulates across reboots |
| Reactor size | Upgrade levels | Yes |
| Objectives | — | Sequential, non-resetting |
| Time Flux | Offline time | Persists |

### 6.5 Part Categories

| Category | Role |
|----------|------|
| `cell` | Generates power and heat; has durability (ticks) |
| `reflector` | Boosts adjacent cell output; has durability |
| `capacitor` | Increases max reactor power; holds heat |
| `vent` | Removes contained heat |
| `heat_exchanger` | Balances heat between adjacent parts |
| `heat_inlet` | Moves heat from parts into reactor |
| `heat_outlet` | Moves heat from reactor into parts |
| `coolant_cell` | High heat containment buffer |
| `reactor_plating` | Increases max reactor heat |
| `particle_accelerator` | Generates EP from contained heat |

Parts may have multiple levels (1–5 standard, level 6 experimental). Experimental parts require EP upgrade prerequisites (`erequires`).

### 6.6 Number Formatting

`fmt(num, places)` in `app.globals.js` converts large numbers to compact notation:

- Standard: `1.234K`, `5.678M`, etc. (powers of 1000)
- Suffixes: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc
- Beyond range: scientific notation fallback

All displayed economy values flow through this formatter for consistency.

---

## 7. Performance Philosophy

This project treats the reactor grid as a **hot path** and optimizes accordingly:

### 7.1 Compositor Layer Isolation

`app.perf.css` promotes frequently updating panels to their own layers:

```css
.speed_hack,
#currency,
#power_indicator,
#heat_indicator,
#tooltip_nav,
#parts {
  will-change: transform;
}
```

This prevents repaints on the reactor grid when stats/parts update multiple times per second.

### 7.2 Quantized Bar Updates

Percent bar widths are rounded to ~3.5% steps (based on 28px bar width):

```javascript
var percentage_interval = Math.round(100/28);
var round_percentage = function(perc, step=1) {
  return Math.round(perc*100/step)*step
}
```

Reduces layout thrashing from sub-pixel width changes every tick.

### 7.3 Dirty-Flag Batching

- `addProperty()` buffers writes in `property_buffer`
- `updateProperty()` flushes once per UI cycle
- UI only updates DOM when `*Updated` flags are true
- `update_interface` runs every 100ms, not every tick

### 7.4 Conditional Rendering

Tile bar updates only run when `#reactor_section.showing` — switching to upgrades page skips reactor DOM work entirely.

### 7.5 Speed Hack Option

Optional `#speed_hack` toggle adds compositor layers to more elements at memory cost. Documents the project's awareness of paint performance as a player-facing concern.

### 7.6 Modernization Constraint

A React re-render of 490 tiles (35×32 max grid) every tick would violate the original design. The original `property_buffer` / `addProperty` system was an early form of fine-grained reactivity — modern equivalents (Proxy, signals, Web Components) achieve the same goal with cleaner APIs.

Preferred paths (in order of alignment with project ideals):

- **Native Proxy or signals** — flag only changed DOM nodes per tick (see [§9.1](#91-reactivity--state))
- **Custom Elements (`<reactor-tile>`)** — encapsulated tile rendering without Shadow DOM overhead (see [§9.2](#92-component-architecture-native-web-components))
- **Web Worker + rAF** — sim off main thread, paint on display refresh (see [§9.3](#93-the-game-engine-web-workers--requestanimationframe))
- **CSS variable-driven visuals** — GPU-offloaded heat/power bar transitions (see [§9.4](#94-layout--aesthetics-modern-vanilla-css))
- DOM-based tile rendering with compositor hints (`will-change`, hardware-accelerated CSS) — see [§9.8.6](#986-avoid-canvas--webgl--threejs-overhaul)

---

## 8. Modernization Principles

### 8.1 Preserve (Identity)

- Grid-centric layout with sidebar palette
- Heat / power / money tristate always visible during play
- Semantic color coding (green = safe/money, red = heat/danger, cyan = power)
- Tooltip/context inspection for parts and tiles
- Toggle-heavy automation controls
- Tick-based incremental honesty (show deltas, use compact numbers)
- Objectives as persistent guidance strip
- Dual reboot paths (standard vs refund)
- Bulk editing affordances
- Meltdown as visible catastrophic failure
- 32px tile grid logic (scale visually if needed, but keep grid topology)

### 8.2 Safe to Modernize (Presentation)

- Replace `border-image` 9-slice assets with CSS `border-radius`, shadows, or SVG frames — **if** panel hierarchy remains (outer frame → panel → subpanel)
- Swap monospace pixel buttons for modern button components — **if** states (default/hover/active/disabled) remain distinct
- Replace GIF explosion with CSS/SVG animation
- Use CSS custom properties for the semantic palette (enables theming without losing meaning)
- Implement proper responsive layout (wire up or replace `app.legacy.css` patterns)
- Replace `alert()` / `confirm()` with in-game dialogs
- Add accessibility: focus rings, ARIA on toggles, keyboard nav for palette
- Consolidate CSS into design tokens
- Link or merge `app.legacy.css` mobile rules (currently orphaned)

### 8.3 Modernize With Caution (Architecture)

| Change | Risk | Mitigation |
|--------|------|------------|
| React/Vue/Svelte rewrite | Tick perf, ID coupling, bundle bloat | Prefer Vanilla-First stack ([§9](#9-vanilla-first-architecture-blueprint)); if framework required, consume extracted sim module only |
| Replace `ui.say()` | Event flow breakage | Migrate to Proxy/signals with same batching semantics |
| Vector/responsive tiles | Layout math breaks | Use CSS Grid with `--cols`/`--rows`; update hotkey grid math together |
| Remove page model for SPA routes | Nav confusion | Keep single-panel view switching |
| Icon-only toggles | Loss of clarity | Pair icons with text or tooltips showing mechanics |
| Change tick interval model | Offline/time flux behavior | Preserve catch-up semantics |
| Shadow DOM on tiles | Memory overhead at 1,120 nodes | Use Custom Elements without Shadow DOM |
| Synchronous localStorage | Main-thread jank on large saves | Migrate to IndexedDB via LocalForage ([§9.7](#97-recommended-minimal-stack-summary)) |

### 8.4 Do Not Change (Mechanics)

- Tick order and heat transfer algorithms
- EP generation formula (log-based chance from contained heat)
- Cost scaling (`cost * multiplier^level`)
- Save format without migration path
- Part adjacency rules and category replacement behavior
- Prestige/reboot semantics
- Objective check conditions
- ES6 Generator macros (`function*` / `yield` in `app.hotkeys.js`) — port cleanly, do not rewrite

### 8.5 Vanilla-First Philosophy

The original author built a custom engine using 2015-era JavaScript — `addProperty`, `property_buffer`, IIFE modules, and ID-driven DOM. That code was clever and performance-conscious. A modernization should **upgrade the tooling**, not replace the philosophy.

**Guiding principle:** Stay close to the metal. Use native browser capabilities (Proxy, Custom Elements, Web Workers, CSS Grid, Popover API) before reaching for frameworks. The final bundle should remain small; execution should remain lightning-fast; the player should never feel UI lag during a meltdown.

Frameworks like React are viable only as a last resort for non-grid UI (help pages, options dialogs) — not for the reactor hot path. See [§9.8](#98-anti-patterns--anti-roadmap).

---

## 9. Vanilla-First Architecture Blueprint

This section defines the recommended minimal, high-performance stack for modernizing the project while staying fiercely loyal to its roots.

### 9.1 Reactivity & State

**Current:** `addProperty()` + `property_buffer` + `*Updated` dirty flags, flushed every 100ms via `update_interface()`.

**Problem solved well, API solved poorly.** The intent — never re-render the full grid when one tile's heat changes — is exactly right. Modern JS offers cleaner mechanisms for the same behavior.

#### Option A: Native Proxy (zero dependencies)

Wrap game state in a `Proxy`. When `game_loop` sets `tile.heat_contained` or `current_power`, the Proxy intercepts the assignment, records the affected DOM node, and schedules a flush on the next animation frame.

```javascript
const pending = new Set();

function reactive(obj, onSet) {
  return new Proxy(obj, {
    set(target, key, value) {
      if (target[key] !== value) {
        target[key] = value;
        onSet(target, key, value);
        pending.add(target);
        scheduleFlush();
      }
      return true;
    }
  });
}
```

**Maps to legacy:** Direct replacement for `addProperty` / `property_buffer` / `updateProperty`. Preserves per-tile, per-property granularity.

#### Option B: `@preact/signals-core` (~1.5kb)

Standalone signals (no UI framework). Bind a signal directly to a DOM text node or attribute; when the value changes, only that node updates. No diffing, no VDOM.

```javascript
import { signal, effect } from '@preact/signals-core';

const currentHeat = signal(0);
effect(() => {
  heatEl.textContent = fmt(currentHeat.value);
});
```

**Maps to legacy:** Equivalent to `var_objs` in `app.ui.js`, but with automatic subscription instead of manual `ui.say('var', ...)`.

#### Recommendation

Simulation runs on **POJOs in a Worker** — no reactive instrumentation during heat transfer ([§9.8.2](#982-avoid-deep-reactivity--global-state-monoliths-redux-deep-vue-proxies)). At the UI boundary only:

- **Dirty flags** — `tile.isDirty = true` when visual state crosses a quantized threshold; rAF flush reads dirty tiles only
- **Shallow Proxy or signals** — watch committed post-sim values for HUD stats (`current_money`, `current_heat`), not per-assignment sim math

Do not introduce a global store that re-renders subtrees.

### 9.2 Component Architecture: Native Web Components

**Current:** Imperative DOM — `$('<button class="tile">')` appended per tile, classes toggled from `app.ui.js`.

**Scale:** Grid reaches 35×32 = **1,120 tiles**. Frameworks that diff tile arrays struggle here without virtualization. The original code avoids this by never re-creating tiles — only mutating classes and bar widths.

#### Approach: Custom Elements (`<reactor-tile>`)

```javascript
class ReactorTile extends HTMLElement {
  connectedCallback() {
    this.classList.add('tile');
    this._percent = document.createElement('p');
    this._percent.className = 'percent';
    this.appendChild(this._percentWrapper());
  }

  setDurability(ratio) {
    this._percent.style.width = `${quantize(ratio)}%`;
  }

  setPart(partId) {
    this.dataset.part = partId;
    this.className = `tile part_${partId}`;
  }
}

customElements.define('reactor-tile', ReactorTile);
```

**Why it fits:**

- Each tile encapsulates its own background sprite and durability bar
- Native browser rendering — no framework reconciliation
- Stable DOM nodes across the tile's lifetime (same as current design)
- Blisteringly fast when combined with dirty-flag or signal updates

**Critical constraint:** Do **not** use Shadow DOM on tiles. At 1,120 instances, Shadow DOM adds meaningful memory overhead. Use Custom Elements as semantic HTML tags with attached methods — light DOM only.

**Maps to legacy:** `evts.tile_added`, `tile.$el`, percent bar updates in `update_interface()`.

### 9.3 The Game Engine: Web Workers + requestAnimationFrame

**Current:** `_game_loop()` runs on the main thread via `setTimeout`. UI updates batched separately at 100ms intervals.

**Goal:** Preserve tactile responsiveness. The sim must not freeze the UI when the grid is chaotic (meltdown, bulk macro placement, offline tick catch-up).

#### Web Worker: Pure Simulation

Move the `Game` class entirely off-DOM into a Worker:

```
Main Thread                          Worker Thread
───────────                          ─────────────
Input events ──postMessage──►        _game_loop()
                                     heat transfer
                                     EP calculation
                                     tile queue
◄──postMessage──  state diff         objective checks
rAF paint cycle
```

- Worker owns: tick loop, heat transfers, part logic, save serialization
- Main thread owns: input, DOM paint, tooltip, page navigation
- Communication: minimal diff payloads (changed tile indices + values), or `SharedArrayBuffer` for high-frequency numeric state if profiling warrants it

#### requestAnimationFrame: Paint Cycle

Replace the 100ms `setTimeout(update_interface)` with rAF-aligned flushes:

```javascript
let dirty = false;

function schedulePaint() {
  if (!dirty) {
    dirty = true;
    requestAnimationFrame(flushDOM);
  }
}

function flushDOM() {
  dirty = false;
  applyPendingTileUpdates();
  applyPendingStatUpdates();
}
```

Paint changes sync to the monitor refresh rate. Combine with Time Flux catch-up (worker runs N ticks; main thread paints once per frame).

**Maps to legacy:** `_game_loop` / `game_loop` split across threads; `update_interface` → rAF flush.

**Preserve:** Tick order (§6.1), offline tick semantics, pause behavior (worker stops scheduling).

### 9.4 Layout & Aesthetics: Modern Vanilla CSS

**Current:** Manual row `<div>` elements, fixed 32px tiles, JS-driven `#reactor_background` color steps, 9-slice `border-image` panels.

#### CSS Grid for Reactor Layout

Replace manual row/column div math:

```css
#reactor {
  display: grid;
  grid-template-columns: repeat(var(--cols, 14), var(--space-tile));
  grid-template-rows: repeat(var(--rows, 11), var(--space-tile));
  gap: 0;
  background: url(../img/tile.png);
  background-repeat: space;
  image-rendering: pixelated;
}
```

JS updates `--cols` and `--rows` when reactor size upgrades expand the grid. Eliminates `evts.row_added` / per-row DOM management.

#### CSS Variables for Heat Warning

Instead of JS setting `backgroundColor` in discrete steps:

```css
#reactor_background {
  background-color: rgb(255 0 0 / var(--core-heat-opacity, 0));
  transition: background-color 0.1s linear;
  pointer-events: none;
}
```

```javascript
const ratio = Math.max(0, (currentHeat - maxHeat) / maxHeat);
document.documentElement.style.setProperty('--core-heat-opacity', Math.min(1, ratio));
```

CSS handles interpolation and GPU compositing. JS only sets one variable per tick.

#### Preserve Retro Border Art

Keep `border-image` pixel chrome — it is core to the aesthetic (§4.1). Optimize with:

```css
button, .tile, .part .image {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

Ensures sharp rendering on 4K/Retina without larger asset files.

**Maps to legacy:** `adjust_primary_size()`, `update_heat_background()`, `#reactor .row` structure.

### 9.5 UI Overlays & Tooltips: Popover API

**Current:** Tooltip hijacks the nav panel (`#main.tooltip_showing #nav { display: none }`). On mobile, fixed overlay. Works, but wastes permanent layout space and requires custom positioning logic.

#### Native Popover API

Modern browsers support the `popover` attribute:

```html
<div id="tile-inspector" popover="auto" role="tooltip">
  <h2 id="tooltip_name"></h2>
  <p id="tooltip_description"></p>
  <!-- existing #tooltip_data fields -->
</div>
```

```javascript
tileEl.addEventListener('pointerenter', () => {
  populateInspector(tile);
  document.getElementById('tile-inspector').showPopover();
});
```

**Benefits:**

- Floating, contextual, does not displace nav or reactor layout
- Native top-layer / z-index management
- No Popper.js or custom fixed-position math

**Preserve dual-mode behavior (§3.3):**

- Part palette inspection (unplaced part stats + cost)
- Tile inspection (live durability, contained heat, sell value, EP chance)
- Same data fields as current `#tooltip_*` IDs

**Fallback:** For browsers without Popover support, retain the current nav-swap pattern or a fixed mobile overlay (from `app.legacy.css`).

### 9.6 Macro Controls: ES6 Generators (Keep Them)

**Current:** Bulk grid editing in `app.hotkeys.js` uses `function*` generators:

- `replacer`, `remover`, `checker`, `row`, `column` — all yield tiles on demand
- `get_tile_in_range` in `app.js` — yields adjacent tiles for heat/reflector logic

**Do not rewrite this logic.** Generators pause execution and yield coordinates on demand. They are memory-efficient for massive grid iteration — no intermediate arrays of 1,120 tile references.

#### Migration path

Port cleanly into ES modules:

```
src/
  engine/
    macros.js       ← hotkeys generators
    heat-range.js   ← get_tile_in_range, heat_exchanger6_range
```

Export generators unchanged. Call sites use `for (const tile of row(tile))` — identical semantics.

### 9.7 Recommended Minimal Stack Summary

| Layer | Choice | Size / Notes |
|-------|--------|--------------|
| **Build tool** | [Vite](https://vitejs.dev/) | Replaces manual `<script>` tags with ES modules; fast HMR for dev |
| **Engine** | Vanilla JS Web Workers + ES6 Classes | `Game`, `Tile`, `Part` as pure modules |
| **State / UI sync** | Native Proxy **or** `@preact/signals-core` (~1.5kb) | Fine-grained DOM updates; no VDOM |
| **UI components** | Vanilla Web Components (`customElements.define`) | `<reactor-tile>`, `<part-button>`, `<stat-bar>` — no Shadow DOM on hot path |
| **Styling** | Vanilla CSS3 — Grid, Flexbox, Custom Properties | No Tailwind; semantic tokens from §10.1 |
| **Storage** | [LocalForage](https://localforage.github.io/localForage/) | IndexedDB wrapper for async, large saves; replaces sync `localStorage` |
| **Tooltips** | Popover API with legacy fallback | Native top-layer positioning |
| **Macros** | ES6 Generators (ported as-is) | Zero change to algorithm |

#### Proposed Module Structure

```
src/
  main.js                 ← entry, rAF loop, worker bridge
  worker/
    game-worker.js        ← tick loop, pure sim
  engine/
    game.js               ← Game class (no DOM)
    tile.js               ← Tile class
    part.js               ← Part class
    loop.js               ← _game_loop tick order
    macros.js             ← generator hotkeys
    heat-range.js         ← adjacency generators
  data/
    parts.js              ← from app.parts.js
    upgrades.js           ← from app.upgrades.js
    objectives.js         ← from app.objectives.js
  ui/
    reactor-tile.js       ← Custom Element
    part-button.js        ← Custom Element
    stat-bar.js           ← Custom Element
    popover-inspector.js  ← tooltip / popover
    page-nav.js           ← _show_page equivalent
    toggles.js            ← create_toggle_button equivalent
  state/
    reactive.js           ← Proxy wrapper OR signals setup
  save/
    save-manager.js       ← LocalForage + optional Google Drive
  css/
    tokens.css            ← design tokens
    layout.css            ← grid, panels, responsive
    components.css        ← tiles, buttons, bars
```

#### Why This Preserves Project Ideals

- Respects the original author's intent: clever, close-to-the-metal code
- Final bundle stays small (no React runtime, no VDOM)
- Execution stays lightning-fast (Worker sim + rAF paint + per-node updates)
- Grid remains the central canvas; heat colors stay honest; toggles stay explicit
- Generators, tick order, prestige loops, and adjacency rules untouched

#### What This Stack Explicitly Avoids

See [§9.8 Anti-Patterns & Anti-Roadmap](#98-anti-patterns--anti-roadmap) for full rationale. Short list:

| Avoid | Reason |
|-------|--------|
| React / Vue / Svelte for grid | VDOM diff of 1,120 nodes per tick |
| Redux / deep reactive grid | Proxy trap overhead during heat transfer math |
| MUI / Bootstrap / design systems | Whitespace bloat; destroys industrial aesthetic |
| Runtime CSS-in-JS | Style recalculation thrashing on heat updates |
| JS number tweening | Unreadable at Time Flux speeds |
| Canvas / WebGL grid overhaul | Breaks hover tooltips, macros, accessibility |
| SPA routers for panels | Dashboard, not a website |
| Shadow DOM on tiles | Memory at scale |
| Tailwind / utility CSS | Conflicts with semantic token system |
| Replacing `setTimeout` tick with rAF for *sim* | Sim tick rate is game-design; rAF is for *paint* only |
| Rewriting generator macros | Already optimal; port only |

### 9.8 Anti-Patterns & Anti-Roadmap

Modern web development has trends and libraries that are actively harmful to this project. **Defer or avoid** the following — each violates core ideals from [§1](#1-core-ideals-non-negotiables) and [§7](#7-performance-philosophy).

> **Rule of thumb:** If a tool abstracts the DOM, dynamically generates CSS at runtime, enforces generous whitespace, or deep-proxies large arrays during simulation, keep it out of this codebase. Modernization means using modern **browser standards** (Web Workers, CSS Grid, ES Modules, Custom Elements) to execute the original author's vision more cleanly — not rewriting the vision to fit a modern SaaS framework.

#### 9.8.1 Avoid: The Virtual DOM (React, Standard Vue)

**The trend:** Map `game.tiles_2d` to framework components and let the Virtual DOM diff the tree each tick.

**Why it breaks core ideals:**

- **Death by diffing:** Late-game grid is 35×32 = **1,120 tiles**. During Time Flux, the loop runs every **10ms** — up to 100 ticks per second. Diffing a tree of 1,120 complex components at that rate blocks the main thread, triggers massive garbage collection stutter, and drains battery.
- **Violates §7.3:** The original design never re-creates tiles — it mutates `className`, `textContent`, and bar widths on stable nodes.

**Alternative:** Native Web Components or explicit signals ([§9.1](#91-reactivity--state), [§9.2](#92-component-architecture-native-web-components)). Bypass the VDOM entirely. Surgically update only the `textContent` or `className` of the tile that changed.

#### 9.8.2 Avoid: Deep Reactivity & Global State Monoliths (Redux, Deep Vue Proxies)

**The trend:** Entire game state in a Redux store, or `reactive()` / deep `Proxy` wrapping the 2D grid array so every mutation is tracked automatically.

**Why it breaks core ideals:**

- **Death by a thousand proxies:** Heat transfer runs many `tile.heat += transfer_heat` operations per tick across adjacent tiles. Deep proxies fire trap/get/set overhead on **every** assignment during raw simulation math.
- **The original author had it right:** `property_buffer` ran simulation as plain math, then pushed **final results** to the UI buffer once per cycle. Sim and presentation were deliberately decoupled.

**Alternative:** Simulation state must remain **Plain Old JavaScript Objects (POJOs)**. The Worker runs uninstrumented math. Only flag a tile as dirty when its **visual** state crosses a threshold (e.g., durability bar width changes by a quantized step). The UI reads dirty tiles on `requestAnimationFrame` — never during `_game_loop`.

> **Note on §9.1 Proxy:** A shallow Proxy at the **UI boundary** (watching final committed values after sim) is acceptable. Deep reactive wrapping of the grid **during** heat transfer is not.

#### 9.8.3 Avoid: Component Libraries & Design Systems (MUI, Ant Design, Bootstrap)

**The trend:** Drop in a ready-made UI library for menus, tooltips, and buttons to ship faster.

**Why it breaks core ideals:**

- **The spreadsheet principle:** Incremental games are highly engaging spreadsheets. Players need massive data density at a glance. Modern design systems default to large hitboxes, heavy padding, and whitespace (optimized for mobile fat-fingers, not factory dashboards).
- **Ruins the aesthetic:** Material drop-shadows, ripple effects, and rounded corporate chrome instantly destroy the gritty retro-industrial control-panel look ([§4.1](#41-aesthetic-identity-retro-sci-fi-control-panel)).
- **Violates §3.1:** Stats, parts palette, and reactor stats bar must stay compact and always visible.

**Alternative:** Raw CSS Grid / Flexbox and custom styling ([§9.4](#94-layout--aesthetics-modern-vanilla-css), [§10](#10-suggested-modern-design-system-mapping)). Tight padding, dense text, sharp pixelated borders. Build `<stat-bar>`, `<part-button>`, and toggle controls as lightweight Custom Elements — not imported from a design system.

#### 9.8.4 Avoid: Runtime CSS-in-JS (Styled Components, Emotion)

**The trend:** Generate CSS class names in JavaScript from component props; inject styles at runtime.

**Why it breaks core ideals:**

- **Style recalculation thrashing:** Tile heat and reactor overlay change constantly. If CSS-in-JS computes `background-color: rgb(255, 0, 0, ${heat_percent})` per tick, the library injects new `<style>` tags into `<head>` multiple times per second, forcing full CSSOM recalculation across the page.
- **Violates §7.2:** Quantized bar updates exist precisely to avoid thrashing layout.

**Alternative:** CSS custom properties set from JS (`element.style.setProperty('--heat', value)`) or swap **static pre-compiled classes** (`.exploding`, `.spent`, `.unaffordable`). All dynamic heat visuals flow through `--core-heat-opacity` ([§9.4](#94-layout--aesthetics-modern-vanilla-css)) — one property, GPU-interpolated.

#### 9.8.5 Avoid: JS-Driven Tweening & Number Interpolation (Framer Motion, React-Spring, CountUp.js)

**The trend:** Smoothly animate stat changes — `$100 → $101 → $102` rolling counters, spring physics on bars.

**Why it breaks core ideals:**

- **Visual mush:** Numbers update too fast. Interpolating cash across 10ms–1000ms Time Flux ticks produces unreadable blur. The JS animation loop competes with the simulation loop for CPU.
- **Violates §1.3 incremental honesty:** Players process hard numbers. The game already shows per-tick deltas (`last tick` wrappers). Animated fluff obscures the data the design intentionally surfaces.

**Alternative:** Instant `textContent` replacement via `fmt()`. If feedback is needed, use lightweight CSS `@keyframes` on the **container** (brief color flash on `#currency` when money increases) — not JS-driven number tweening.

#### 9.8.6 Avoid: Canvas / WebGL / Three.js Overhaul

**The trend:** "Modernize" by moving grid rendering to `<canvas>` or adding 2.5D WebGL effects.

**Why it breaks core ideals:**

- **Over-engineering:** Canvas is fast for many sprites but breaks DOM hover for tooltips ([§3.3](#33-tooltip-as-context-panel)), complicates macro hotkey hit-testing ([§5.2](#52-bulk-editing-hotkeys)), and removes native focus/keyboard accessibility.
- **Loss of charm:** GIF-based animations (explosion sprite sheet, spinning fan sprites, glowing rods) are iconic to early incremental web games ([§4.4](#44-grid--tile-visual-language)).
- **Unnecessary at this scale:** 1,000 DOM nodes is manageable without a framework fight. Use `will-change: transform, opacity` and hardware-accelerated CSS ([§7.1](#71-compositor-layer-isolation)) — the original `app.perf.css` Speed Hack pattern.

**Alternative:** DOM-based rendering with Custom Elements ([§9.2](#92-component-architecture-native-web-components)). Only reconsider Canvas if profiling on target hardware proves DOM paint is genuinely exhausted **after** Worker + rAF + dirty-flag optimization — and even then, preserve a DOM overlay for tooltips and input.

#### 9.8.7 Avoid: SPA Routers (React Router, Vue Router)

**The trend:** Route `/reactor`, `/upgrades`, `/experiments` with URL history management.

**Why it breaks core ideals:**

- **Dashboard, not a website:** Players switch panels instantly to manage their factory. Pushing browser history on every tab click is disorienting and breaks the illusion of operating a **single machine interface** ([§3.2](#32-page-navigation-model)).
- **Violates instant context switching:** Reactor must remain one click away; objectives strip and stats must stay visible regardless of active panel.

**Alternative:** Simple visibility toggling — `.page { display: none }` / `.showing { display: inherit }` as today, or CSS `z-index` layering. `_show_page()` ([§3.2](#32-page-navigation-model)) ported to a thin module; no router, no history API.

#### 9.8.8 Anti-Roadmap Summary

| # | Avoid | Core ideal violated | Use instead |
|---|-------|---------------------|-------------|
| 1 | Virtual DOM (React, Vue) | Performance / grid centrality | Custom Elements, signals, surgical DOM updates |
| 2 | Redux / deep reactive grid | Sim/UI separation | POJO sim in Worker; dirty flags at UI boundary |
| 3 | MUI / Bootstrap / design systems | Data density / aesthetic | Custom CSS Grid/Flexbox, tight industrial chrome |
| 4 | Runtime CSS-in-JS | Paint perf on heat updates | CSS variables, static classes |
| 5 | JS number tweening | Incremental honesty | Instant `fmt()` replacement; optional CSS flash |
| 6 | Canvas / WebGL grid | Tooltips, macros, charm | DOM + compositor hints |
| 7 | SPA routers | Single control panel | `.showing` visibility toggle |

**Modernization of Reactor Knockoff** = modern browser standards executing the original vision more cleanly. Not a rewrite to fit a SaaS framework template.

---

## 10. Suggested Modern Design System Mapping

For a contemporary UI that respects this project's soul:

### 10.1 Design Tokens

```css
:root {
  /* Semantic — do not remap meanings */
  --color-money:       #59c435;
  --color-power:       #33a5c6;
  --color-heat:        #ef4444;
  --color-selected:    #59c435;
  --color-surface-0:   #000204;
  --color-surface-1:   #485667;
  --color-surface-2:   #222C38;
  --color-chrome:      #76809b;
  --color-chrome-hover:#91a1c8;
  --color-text:        #ffffff;
  --color-link:        #d3f5f6;
  --color-link-visited:#c3a5f6;

  --space-tile:        32px;
  --space-sidebar:     261px;
  --radius-panel:      4px;
  --radius-button:     4px;

  --font-data:         ui-monospace, 'Cascadia Code', monospace;
  --font-ui:           system-ui, sans-serif;
  --font-size-data:    0.8em;
  --font-size-button:  13.5px;
  --font-size-heading: 18px;

  --shadow-text-outline: 1px 0 0 #000, 0 1px 0 #000, -1px 0 0 #000, 0 -1px 0 #000;
  --shadow-heading:      1px 1px 3px rgba(0, 0, 0, 1);

  /* Runtime — set by JS each tick (§9.4) */
  --core-heat-opacity:   0;
  --cols:                14;
  --rows:                11;
}
```

### 10.2 Component Equivalents

| Legacy | Modern Equivalent | Must Keep |
|--------|-------------------|-----------|
| `.panel` + border-image | Card with inset border / glass panel | Visual nesting depth |
| `.subpanel` | Inset content area | Data grouping |
| `.part_active` / `.tile:focus` | Selected tool state | Green selection ring |
| `#heat_percentage` fill | Progress bar component | Red, behind monospace text |
| `#power_percentage` fill | Progress bar component | Cyan, behind monospace text |
| `#currency` | Highlighted stat card | Green background |
| `.nav` page buttons | Segmented control / tabs | Reactor as default tab |
| `#tooltip` | Popover inspector / drawer ([§9.5](#95-ui-overlays--tooltips-popover-api)) | Contextual, same data fields |
| `.unaffordable` | Disabled + dimmed | ~50% opacity convention |
| `.exploding` | Destruction animation | Clear component loss feedback |
| `.spent` | Grayscale filter | Depleted cell visual |
| `#reactor_background` | Overlay layer | Red heat warning gradient |
| Toggle buttons | Switch with label | Text inverts with state |
| `.tile` button | `<reactor-tile>` Custom Element | 32px grid cell, light DOM |
| `#reactor .row` | CSS Grid on `#reactor` | `--cols` / `--rows` variables |
| `addProperty` / `ui.say` | Proxy or `@preact/signals-core` | Per-node dirty updates |
| `localStorage` sync save | LocalForage (IndexedDB) | Async, large save support |
| `setTimeout` UI flush | `requestAnimationFrame` | Paint aligned to display refresh |
| `_game_loop` on main thread | Web Worker sim + diff to main | Input never blocked by tick |

### 10.3 Responsive Layout Target

```
Desktop (≥939px):
  [ Stats + Parts sidebar ] | [ Nav/Tooltip ] [ Objectives ] [ Reactor/Upgrades ]

Tablet / Mobile (≤938px):
  [ Stats bar — fixed top ]
  [ Reactor — maximized center ]
  [ Parts — bottom sheet / collapsible drawer ]
  [ Tooltip — fixed overlay when active ]
```

Preserve the **mobile part-selection collapse** (`#main.part_active`) — essential for usable touch placement.

---

## 11. File Reference Map

| File | Responsibility |
|------|---------------|
| `index.html` | Region structure, element IDs, script load order |
| `css/app.css` | Primary layout, colors, components, pages, tooltip, reactor grid |
| `css/app.perf.css` | Compositor layer hints for hot panels |
| `css/cms.css` | Prose normalization for help/about/options |
| `css/reset.css` | Base CSS reset |
| `css/app.legacy.css` | Mobile breakpoint rules (**not currently linked in HTML**) |
| `css/normalize.css` | Normalize.css (not linked in HTML) |
| `js/app.js` | Game sim, tiles, loop, placement, tooltips, save interface |
| `js/app.ui.js` | DOM binding, toggles, page nav, objective UI |
| `js/app.globals.js` | `$`, `fmt`, `addProperty`, `delegate`, `updateProperty` |
| `js/app.compat.js` | Browser compatibility polyfills |
| `js/app.parts.js` | Part definitions (declarative data) |
| `js/app.upgrades.js` | Upgrade definitions (data + onclick hooks) |
| `js/app.objectives.js` | Objective chain (data + check functions) |
| `js/app.upgrade.js` | Upgrade DOM object class |
| `js/app.save.js` | LocalSaver / GoogleSaver persistence |
| `js/app.hotkeys.js` | Bulk edit tile generators |
| `img/` | Sprites, borders, icons, tile backgrounds, explosion GIF |

### Target Structure (Post-Modernization)

See [§9.7 Proposed Module Structure](#97-recommended-minimal-stack-summary) for the Vite-based `src/` layout that replaces the flat `js/` + `css/` files above.

---

## 12. Modernization Roadmap

Recommended implementation order aligned with the [Vanilla-First stack (§9)](#9-vanilla-first-architecture-blueprint):

### Phase 1 — Foundation (No Behavior Change)

1. Introduce **Vite** — convert IIFE scripts to ES modules without logic changes
2. Extract **CSS custom properties** from `app.css` semantic colors and spacing (§10.1)
3. Link or merge `app.legacy.css` responsive rules into active stylesheet
4. Document `ui.say()` / `addProperty` as the reactivity contract to be replaced

### Phase 2 — Visual Refresh (Presentation Only)

5. Replace manual reactor rows with **CSS Grid** (`--cols`, `--rows`) — same tile count, simpler DOM
6. Migrate heat overlay to **CSS variable** (`--core-heat-opacity`) — remove JS color stepping
7. Modernize button states while preserving text labels and toggle semantics
8. Replace GIF explosion with CSS/SVG animation
9. Replace native `alert()` / `confirm()` with styled in-game dialogs

### Phase 3 — Engine Extraction (Structural)

10. Extract `Game`, `Tile`, `Part`, `_game_loop` to **zero-DOM ES modules**
11. Port **generators** (`app.hotkeys.js`, `get_tile_in_range`) to `engine/macros.js` unchanged
12. Move sim into a **Web Worker**; main thread receives minimal state diffs
13. Replace `addProperty` / `property_buffer` with **Proxy** or **signals**
14. Replace `setTimeout(update_interface)` with **requestAnimationFrame** paint flush

### Phase 4 — Component & API Modernization

15. Implement `<reactor-tile>` and `<part-button>` as **Custom Elements** (light DOM)
16. Adopt **Popover API** for tooltips with nav-swap fallback for unsupported browsers
17. Migrate saves to **LocalForage** (IndexedDB) with localStorage import path for existing players
18. Add accessibility: ARIA roles, focus management, keyboard navigation

### Phase 5 — Optional Enhancements

19. Theming system built on semantic tokens (dark default, optional variants)
20. Google Drive save adapter ported to async LocalForage-backed pipeline
21. Accessibility polish beyond Phase 4 baseline (screen reader labels for stats)

### Anti-Roadmap

Full rationale for each item: [§9.8 Anti-Patterns & Anti-Roadmap](#98-anti-patterns--anti-roadmap).

Quick reference — **do not adopt:**

- Virtual DOM frameworks on the grid (React, Vue, Svelte)
- Redux or deep reactive wrapping of simulation state
- Component libraries / design systems (MUI, Ant Design, Bootstrap)
- Runtime CSS-in-JS (Styled Components, Emotion)
- JS number tweening (Framer Motion, React-Spring, CountUp.js)
- Canvas / WebGL / Three.js grid overhaul
- SPA routers for panel navigation (React Router, Vue Router)
- Shadow DOM on per-tile components
- Tailwind or utility-first CSS migration
- Rewriting generator-based macro logic
- Changing tick order or heat transfer algorithms

---

## 13. Summary

Reactor Knockoff is a **grid-first incremental game** dressed in **retro sci-fi HUD chrome**. Its identity lives in:

- The spatial reactor puzzle
- Heat as risk/reward
- Dense, always-visible economy telemetry
- Toggle-driven automation
- EP prestige loops
- Performance-conscious incremental UI updates

A modern redesign should feel cleaner, scale better on mobile, and meet accessibility standards — but it should still read as a **control panel for a dangerous reactor**, not a generic idle clicker.

**Keep the grid central. Keep the colors honest. Keep the numbers loud. Keep the player one click away from meltdown.**

The recommended path is **Vanilla-First**: Vite + ES modules, Web Worker sim, POJO math with dirty-flag UI sync, Custom Elements for tiles, CSS Grid + variables for layout, Popover API for tooltips, LocalForage for saves. No framework on the hot path. See [§9.8](#98-anti-patterns--anti-roadmap) for what to actively avoid.

---

*Document version: 1.2 — Anti-Patterns & Anti-Roadmap (§9.8) added*
