# First Engine Demo Scope

The first demo lives in `packages/engine-demo`. It is not a content vertical
slice yet. It should be a small, focused engine proving ground for canvas
rendering, side-view movement feel, basic sound, ray-based lighting, and
diagnostics.

## Demo Goals

- Prove a character can move through one authored side-view area.
- Prove gravity, jumping, landing, and solid platform collision.
- Prove canvas rendering can support crisp pixel-art style presentation.
- Prove basic sound can be triggered from user input or movement.
- Prove ray-based lighting or visibility can create atmosphere without hiding
  fair combat information.
- Prove the canvas renderer can support the demo without React.
- Prove the accessible UI/menu module can handle basic interaction outside the
  game canvas.
- Prove the debug system can expose frame rate, frame time, memory signals, and
  engine subsystem costs.

## Suggested Content

- One single authored side-view area.
- One controllable character.
- A few platforms, walls, pillars, or occluders that rays can hit.
- One dark or partially occluded space with ray-based light, shadow, or reveal.
- Basic sound feedback such as footsteps, interaction tones, or ambience.
- One accessible menu or pause/settings surface using native HTML controls if
  the demo needs UI beyond the canvas.
- One bulky debug overlay/panel for movement, collision if present, lighting,
  performance, and memory diagnostics.

## Acceptance Criteria

- The character can run and jump within the single side-view area.
- The character cannot pass through solid platforms, walls, or occluders.
- Gravity, landing, and grounded state are visible in debug signals.
- Sound starts only after a user gesture and can provide basic feedback.
- Lighting and shadows support the mood without obscuring required telegraphs.
- The demo runs through canvas rendering without React.
- Keyboard-accessible UI exists for at least one menu/debug interaction.
- Frame rate, frame timing, subsystem timing, and memory/resource signals are
  visible during development.
- The demo can be restarted repeatedly without broken state.
- Debug tools can explain what the engine thinks is happening.

## Out Of Scope

- Multiple areas.
- Top-down, three-quarter, isometric, or hybrid movement.
- Enemies.
- Bosses.
- Combat.
- Large map production.
- Final art pass.
- Final music or soundscape.
- Deep progression.
- Complex equipment.
- Full NPC dialogue.
- Procedural generation.
- React UI.
- Permanent save system beyond simple demo state, unless easy and useful.
