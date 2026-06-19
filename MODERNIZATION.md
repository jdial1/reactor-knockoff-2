Phase 1: Foundation & Semantic Restructuring (The "Vanilla-First" Base)

Before shifting pixels, the underlying architecture must support a modern, responsive environment without breaking the simulation.

    1.1 Tooling & Modularization (per §9.7): Migrate the flat imperative JavaScript files to ES Modules using Vite. Extract Game, Tile, and Part logic into zero-DOM pure modules.

    1.2 Design Tokens Initialization (per §10.1): Extract all hardcoded colors, borders, and typography into CSS Custom Properties (:root). Preserve the semantic color mapping (Green = Safe/Money, Red = Danger/Heat, Cyan = Stored Energy).

    1.3 Data Persistence Upgrades: Swap synchronous localStorage for LocalForage (IndexedDB wrapper) to prevent main-thread freezing on mobile devices when saving large mid-game grids.

Phase 1 Anti-Patterns & Things to Avoid
🚫 During 1.1: Tooling & Modularization

    Avoid "Refactor Creep" (Changing Mechanics):
    Do not attempt to optimize the simulation algorithms, tick execution order (§6.1), or tile adjacency mechanics while converting scripts to ES modules. Keep the modularization strictly structural. Changing math or logic flow in this step makes debugging desyncs between legacy and modern code exceptionally difficult.

    Avoid Rewriting Generator Macros (§9.6):
    Do not replace the ES6 generators (function* and yield in app.hotkeys.js) with standard array-based iterators. Generators are used because they iterate over the grid lazily, keeping memory overhead close to zero. Keep them exactly as they are when moving them to the modern structure.

    Avoid Over-Installing npm Packages:
    Vite allows easy installation of dependencies, but do not pull in heavy utility libraries (e.g., Lodash, jQuery-esque helpers, or state-management suites). Stick to native, modern browser APIs. The final JS bundle should remain extremely lightweight.

🚫 During 1.2: Design Tokens & CSS Extraction

    Avoid Tailwind / Utility CSS Migrations (§9.8):
    Do not introduce utility-first frameworks like Tailwind. Utility frameworks conflict with the semantic token system (§10.1) and make it incredibly difficult to manage the precise, pixel-aligned nested panels (§4.1) of the retro sci-fi HUD. Stick to standard vanilla CSS.

    Avoid CSS-in-JS Libraries (§9.8.4):
    Do not adopt libraries like Styled Components or Emotion. Generating styles dynamically at runtime causes heavy layout thrashing and style recalculations when updating highly dynamic parameters like reactor heat and power bars several times a second.

    Avoid Over-Smoothing / Flat Designs:
    Do not eliminate the 9-slice border-image assets (§4.1) in an attempt to make the game look like a flat, modern material web app. The gritty, industrial, physical control panel aesthetic is a non-negotiable core ideal (§8.1). CSS custom properties should only define the color palette, fonts, and grid sizes.

🚫 During 1.3: Data Persistence & LocalForage

    Avoid Breaking Save-File Compatibility:
    Do not change the base64-encoded JSON schema without writing a robust migration script. Any modernization must read existing player saves from synchronous localStorage (rks), import them into LocalForage (IndexedDB), and cleanly retire the old key.

    Avoid Save State Bloat:
    Do not serialize the entire runtime Game or Tile class instances. Keep the save data minimal (§5.5)—strictly saving IDs, levels, ticks, and states—to avoid hitting IndexedDB transaction limits during high-frequency auto-saves.

    Avoid Save-Loop Race Conditions:
    Because IndexedDB operates asynchronously (unlike synchronous localStorage), auto-saves do not complete instantly. Avoid queuing multiple saves back-to-back without checking if the previous database write transaction has resolved. This prevents write-locking and save corruption.

Phase 2: Mobile-First Layout Architecture (The Core UX Shift)

This phase implements the target layout defined in §10.3, transitioning the UI from a desktop-first dual-pane layout to a touch-optimized stacked layout.

    2.1 The Fixed Telemetry Header: Pin the stats section (#stats_section) to the top of the viewport (position: fixed; z-index: 10). Keep it compact but ensure the Heat, Power, and Currency tristate is always visible. Add a [+] toggle to expand per-tick details seamlessly.

    2.2 The Central Reactor Canvas: Convert the manual div rows to a CSS Grid (display: grid; grid-template-columns: repeat(var(--cols), var(--space-tile))). The grid is the primary mobile workspace. Implement pinch-to-zoom and pan functionality to allow players to manage large late-game grids (up to 35x32) on small screens.

    2.3 The Bottom Sheet Parts Palette: Convert the right-hand parts palette into a collapsible bottom drawer.

        Crucial Interaction (§5.4): When a player taps a part to place it, the drawer must automatically collapse down to show only the active part, maximizing the screen space for the reactor grid.

    2.4 Bottom Navigation Bar: Move the page navigation (Reactor, Upgrades, Experiments, Options) into a fixed mobile tab bar just above the parts drawer. Keep "Reactor" as the default, one-tap-away view.

Phase 2 Anti-Patterns & Things to Avoid
🚫 During 2.1: The Fixed Telemetry Header

    Avoid Hiding Critical Telemetry for "Cleanliness":
    Modern mobile design often prioritizes minimal interfaces, but incremental game players make decisions based on hard data. Do not hide the core resource changes (e.g., +X last tick or EP/TF counters) inside submenus or hamburger links. Keep numbers visible but compact by using tight monospace fonts and abbreviation utilities (fmt()).

    Avoid Tall Viewport Headers:
    On mobile, landscape or portrait, vertical screen space is precious. Keep the telemetry header strictly under 60px in height. Avoid using overly padded cards or margins. Let the numbers sit tight and pixel-dense (§4.1).

🚫 During 2.2: The Central Reactor Canvas

    Avoid Shrinking Tiles to Fit the Screen (Violating §4.4):
    Do not scale the 32x32px tiles down (e.g., to 12x12px) to fit the whole grid on a portrait mobile screen without scrolling. This makes tiles impossible to tap with a finger (fat-finger problem).

        Correct Approach: Keep tiles at 32x32px (or slightly larger for touch comfort, e.g., 36px) and allow the player to scroll/pan across the grid, or provide a clean viewport zoom utility.

    Avoid Relying on Hover-State Interactions (§3.3):
    Desktop uses mouseover/mouseout to inspect tile contents. Mobile devices do not have hovers. Do not build a layout where critical part information is only accessible on hover. Ensure tile details are retrieved via explicit taps, long-presses, or a dedicated "Inspector Mode."

    Avoid Using Flexbox or Manual Float Math for the Grid Layout:
    Do not rely on the legacy behavior of wrapping manual row divs. Let CSS Grid manage the topology completely using --cols and --rows CSS variables. Managing individual row DOM wrappers on mobile causes unnecessary nested node overhead during pan-and-zoom calculations.

🚫 During 2.3: The Bottom Sheet Parts Palette

    Avoid Drag-and-Drop for Part Placement (§5.1):
    Do not use complex drag-and-drop patterns to move parts from the drawer onto the grid on mobile. Dragging elements with a finger obscures the target tile under the player's hand.

        Correct Approach: Retain the active tool paradigm. Tap a part in the drawer to "arm" the cursor/finger, collapse the drawer, then tap tiles to place or replace components.

    Avoid Blocking the Grid with the Drawer:
    Do not let the bottom drawer float statically over the reactor canvas. When active, it must either slide out of the way or collapse entirely once a part is selected (§5.4). Viewport collision between the drawer and the active grid must be dynamically managed.

🚫 During 2.4: Bottom Navigation Bar

    Avoid Traditional URL Routing or Screen-Blocking Modals (§9.8.7):
    Do not use a router to load new pages for Upgrades or Experiments. Changing views should behave like tab switching, using simple visibility toggles (.showing). If transitioning between pages feels like navigating a new website rather than adjusting dials on a single machine interface, the retro-control-panel immersion is broken.


Phase 3: Component & Interaction Modernization

With the mobile structure in place, modernize the interaction patterns using native browser APIs, replacing clunky legacy behaviors.

    3.1 Custom Elements (per §9.2): Convert the 32x32px .tile buttons into native <reactor-tile> Custom Elements (Light DOM only, no Shadow DOM to save memory on mobile). Ensure the pixel-art aesthetic and bottom 2px durability/containment bars remain pixel-perfect.

    3.2 Popover API for Tooltips (per §9.5): Replace the legacy nav-hijacking tooltip with the native Popover API. On mobile, tapping and holding a tile or part should bring up a contextual, floating popover showing live durability, contained heat, and EP chance without breaking the layout.

    3.3 Touch-Friendly Controls (per §5.3): Convert legacy toggle buttons (Pause, Auto-Sell, Time Flux) into modern, chunky switch components. Rule: Always pair the switch with the explicit text label (e.g., "Enable Auto-Sell") so mechanical meaning is never lost to an ambiguous icon.

    3.4 Modal Dialogs: Replace blocking alert() and confirm() prompts (used for saving and reboots) with native <dialog> elements styled as retro-industrial popups.

Phase 3 Anti-Patterns & Things to Avoid
🚫 During 3.1: Custom Elements (<reactor-tile>)

    Avoid Using Shadow DOM for Tiles (Violating §9.2):
    Do not attach a Shadow Root (this.attachShadow({mode: 'open'})) to the <reactor-tile> elements. At the maximum grid size of 35x32, creating 1,120 separate Shadow DOM contexts incurs a massive memory and CPU initialization penalty on mobile browsers. Use simple Custom Elements operating in the Light DOM.

    Avoid DOM Node Instabilities:
    Do not tear down and re-append <reactor-tile> nodes when a part is replaced or sold. Instead, update attributes on the existing, stable DOM node (e.g., tile.setAttribute('part', 'uranium1') or changing dataset values). Re-instantiating elements causes severe garbage collection pauses on mobile devices during bulk editing.

    Avoid Heavy Internal Shadow/Element Queries:
    Avoid calling this.querySelector('.percent') inside your element's lifecycle or update hooks. Keep direct, cached references to sub-elements (like this.$percent) as instance properties during connectedCallback() to keep DOM traversal during active ticks at absolute zero.

🚫 During 3.2: Popover API for Tooltips

    Avoid Obstructing the Workspace on Mobile:
    On desktop, tooltips appear next to the cursor. On mobile, attaching the popover directly to the touch point means the tooltip will be buried under the player's finger.

        Correct Approach: Render the tooltip in a fixed, dedicated slot (such as anchoring it near the telemetry header or bottom navigation) while a touch-hold event is active, keeping the tile area clear for placement.

    Avoid Tooltips Hijacking Pointer Events:
    Ensure that floating popovers are styled with pointer-events: none when they are active. If they capture touch/click events, they will block the player from drawing lines of parts or tapping adjacent tiles.

🚫 During 3.3: Touch-Friendly Controls

    Avoid Over-Simplification of Labels (§1.4 / §5.3):
    Do not replace functional toggle text with flat visual icons (e.g., changing "Disable Heat Controller" to a basic power icon). In a mechanical game, players need to know exactly what function is currently armed. Retain clear, explicit textual labels.

    Avoid Eliminating the Tactile "Pressed" States (§4.1):
    Modern mobile buttons often look flat and static. Do not eliminate the physical feedback of the legacy retro-industrial theme. Ensure that buttons utilize active CSS states (:active) that shifting borders or background colors down (mimicking physical spring-loaded keys) so players know a touch was registered.

🚫 During 3.4: Modal Dialogs

    Avoid Importing Heavy Modal Libraries:
    Do not import heavy JavaScript modal packages. Stick to the native browser <dialog> element. It handles focus trapping, accessibility, escape-key behaviors, and top-layer centering out-of-the-box with zero configuration and zero performance overhead.

    Avoid Sim-Math Leakage Under Dialogs:
    When a blocking confirmation dialog is open (such as the "Reboot/Refund Confirmation" or "Save Import"), ensure that either the game is paused behind the modal, or interactions with the underlying grid are completely disabled using a backdrop layer. Players must not be able to place parts or trigger explosions while navigating menus.

Phase 4: Engine Extraction & Mobile Performance (Invisible UX)

Mobile devices have strict thermal and battery limits. The 10ms "Time Flux" catch-up loop will crash a mobile browser if tied to DOM rendering.

    4.1 Web Worker Sim Isolation (per §9.3): Move the entire _game_loop and heat transfer algorithms into a Web Worker. The main thread should only handle user input and painting the UI.

    4.2 Reactive Paint Cycle: Implement a shallow Proxy or @preact/signals-core at the UI boundary. Flag tiles as "dirty" during the worker's simulation, but only read and paint those dirty tiles via requestAnimationFrame on the main thread. This ensures the UI remains at a buttery 60fps on mobile, even during a catastrophic meltdown.

    4.3 CSS-Driven Heat Overlays (per §9.4): Remove JavaScript-driven background color steps. Use a single CSS variable (--core-heat-opacity) updated once per tick to let the mobile GPU handle the red screen flashing as the reactor overheats.

Phase 4 Anti-Patterns & Things to Avoid
🚫 During 4.1: Web Worker Sim Isolation

    Avoid Serializing the Full Grid Array Every Tick:
    Do not stringify or send the entire 1,120-tile map via postMessage on every tick. Serializing, transferring, and deserializing a massive nested array 10 to 100 times a second (especially during high-frequency Time Flux ticks) will completely saturate the main thread’s message queue, tanking mobile performance.

        Correct Approach: Transfer only index-based diffs (e.g., { index: 405, heat: 50, ticks: 12 }) of tiles that actually changed state during that tick, or use a flat, shared memory block (SharedArrayBuffer wrapping a TypedArray like Float64Array) for zero-copy state synchronization.

    Avoid Importing DOM Dependencies in the Worker Context:
    Ensure the Web Worker file remains completely decoupled. Do not import any code that references window, document, or DOM elements. The simulation engine inside the worker must be treated as a pure mathematical matrix state machine.

🚫 During 4.2: Reactive Paint Cycle

    Avoid Deep Reactive Proxies on the Hot Path (§9.8.2):
    Do not wrap the active simulation grid in deep proxies or state-tracking frameworks (like standard Vue reactivity or Redux) inside the worker. Running deep proxy get/set interception inside highly nested loops (such as heat balancing calculations across 1,120 cells) introduces immense execution overhead.

        Correct Approach: Run the tick simulation using Plain Old JavaScript Objects (POJOs) and raw math. Only commit state changes at the end of the simulation tick, emitting a single batched payload of changed attributes to the UI thread.

    Avoid Unthrottled requestAnimationFrame Loops:
    Do not run requestAnimationFrame flushes if nothing in the game state has changed, or if the reactor grid page is currently hidden (§7.4). If a user is spending 5 minutes reading the "Help" section, the main thread should entirely skip reactor visual recalculations to preserve mobile battery.

🚫 During 4.3: CSS-Driven Heat Overlays

    Avoid Updating Styles on Individual Elements via JS:
    Do not let the simulation loop directly modify CSS style properties on hundreds of individual elements (like manually changing .style.backgroundColor on every cell). This causes the browser layout engine to repeatedly calculate layout bounds (layout thrashing).

        Correct Approach: Update variables at the :root level (§9.4) or swap predefined class selectors (.spent, .exploding, .unaffordable) on elements. Let the browser's native CSS compositor handle visual updates and GPU rendering.

    Avoid Animating Layout-Impacting Properties:
    Do not trigger transitions on properties like width, height, or margin to animate elements. Only animate GPU-accelerated compositing layers such as transform (for sizing or positioning), opacity, or filter. This keeps paint costs on mobile devices close to zero.

Phase 5: Mobile Power-User Workflows (Bridging the Desktop Gap)

Desktop relies heavily on keyboard modifiers (Ctrl/Alt/Shift + Click) for bulk editing (§5.2). Mobile needs an equivalent UX for late-game layout optimization.

    5.1 "Macro Mode" Toggle: Introduce a floating action button (FAB) or toggle in the UI to enter "Macro Mode."

    5.2 Gesture Mapping: Map the ES6 Generator logic (hotkeys.js) to touch gestures:

        Drag-to-paint: Tap and drag across the grid to place a line of parts.

        Double-tap: Fill row/column (replacing the Ctrl/Alt click).

        Two-finger tap: Delete/Sell part.

    5.3 Haptic Feedback: Utilize the Navigator.vibrate() API to provide tactile feedback: a light tick when placing a part, a subtle buzz when a cell depletes, and a heavy rumble during a reactor meltdown.

    5.4 CSS Animations: Replace the legacy GIF explosion with a lightweight CSS/SVG keyframe animation to reduce memory overhead and ensure crisp scaling on high-DPI retina mobile screens.

Phase 5 Anti-Patterns & Things to Avoid
🚫 During 5.1 & 5.2: Gestures & "Macro Mode"

    Avoid Hijacking Native Browser Scrolling:
    Do not intercept default touch navigation swipe gestures (touchstart / touchmove) across the entire screen for part placement without an explicit state toggle. If players cannot swipe to scroll or pan around zoomed regions because the game assumes every swipe is a "drag-to-paint" macro, the mobile web wrapper becomes unusable.

        Correct Approach: Only override touch movements when the player has explicitly toggled the "Macro Mode" switch (§5.1). Keep native touch panning active during normal operation.

    Avoid Processing Touchmove Events at Sub-Pixel Resolutions:
    Touchmove events fire at a much higher frequency than mouse moves on mobile displays. Do not trigger part-checking or placement calculations on every raw pixel coordinate of a drag event. This creates massive event queue blockages.

        Correct Approach: Gate touch coordinates through the active tile bounds. Only execute placement checks when the touch coordinates cross from one 32x32px tile cell coordinate into another.

🚫 During 5.3: Haptic Feedback (Vibrations)

    Avoid Intrusive or Continuous Vibrations:
    Do not run persistent or heavy vibration patterns (e.g., vibrating non-stop as long as the reactor is in a high-heat state). Continuous use of Navigator.vibrate() quickly drains battery, heats up the device, and causes user fatigue.

        Correct Approach: Keep feedback short and crisp. Use extremely short pulses (e.g., [15] ms) for placement confirmation, slightly longer double-pulses for errors, and a single cascading sequence only at the split-second of a total meltdown event.

    Avoid Forced Haptics Without an Off Switch:
    Do not run haptic vibrations without respecting user preferences. Always provide a toggle in the Options menu (§1.4 / §5.5) to disable vibrations entirely. Check for browser support before calling Navigator.vibrate() to avoid throwing runtime exceptions.

🚫 During 5.4: CSS Animations

    Avoid Overwhelming the GPU During Meltdowns:
    During a total reactor meltdown (§6.3), potentially hundreds of tiles will explode simultaneously. Avoid spawning separate, unthrottled CSS keyframe animations with complex box-shadows or drop-filters on hundreds of elements at the exact same moment, as this will drop the frame rate to single digits on mobile hardware.

        Correct Approach: Batch the tiles. Trigger a localized explosion animation class on a limited subset of tiles, and simply transition the rest of the grid elements instantly to "spent" or "melted" states using static classes.

🚫 During Accessibility Implementations

    Avoid Relying Solely on Color Coding (§4.2):
    Do not use color alone (such as Green for safe/durability and Red for danger/heat) to communicate the operational status of components. Red-green color-blind players will struggle to distinguish between a healthy fuel cell (green bar) and a critically filled coolant cell (red bar).

        Correct Approach: Use unique progress bar designs or subtle texture masks (e.g., a solid fill for durability, a diagonal striped hatch pattern for contained heat) in addition to color mapping to differentiate active states.

Summary of the UX Philosophy

By following these phases, the game remains a dark, dense, retro-industrial control panel. You will not be making it look like a sleek, rounded SaaS dashboard (which violates §4.1). Instead, you are adapting the "spreadsheet" nature of the game so that mobile players have immediate access to their grid, absolute clarity on their heat risks (via semantic colors), and zero UI lag.