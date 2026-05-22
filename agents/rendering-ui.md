# Rendering And UI

`strange-path` should not use React. The game should render through canvas, with
UI and accessibility handled as a separate engine concern.

## Game Rendering

- Use canvas for the game view.
- Keep simulation independent from rendering.
- Keep pixel-art scaling crisp and predictable.
- Prefer deterministic camera and draw ordering.
- Avoid per-frame allocations in renderer hot paths.
- Batch, cache, and pre-render where it improves measurable performance.
- Use libraries and packages when they materially improve rendering, asset
  loading, sprite animation, batching, or lighting.

## UI And Accessibility Module

Menus, settings, pause screens, text entry, debug controls, and similar
interaction-heavy surfaces should be handled by a separate non-React UI module.

Use native HTML elements when possible so the browser gives the game:

- Keyboard focus behavior.
- Tab order.
- Buttons, sliders, checkboxes, selects, and text inputs.
- Screen-reader semantics where practical.
- Form behavior where useful.

If a menu has a canvas visual treatment, keep equivalent DOM-backed controls or
labels for accessibility and keyboard interaction.

## Boundary Rules

- Canvas owns the game world rendering.
- The UI module owns menus, overlays, accessibility, and interaction controls.
- Engine systems should expose state to UI through explicit APIs or events.
- UI should not reach into simulation internals to mutate state arbitrarily.
- Debug panels may inspect engine internals, but they should be isolated from
  normal game UI.
