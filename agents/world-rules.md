# World Rules

These are early world and map design rules for `strange-path`. They should guide
implementation and content decisions until a fuller world bible exists.

## Storytelling

- The world history is not directly narrated.
- NPCs hint, misremember, warn, or steer. They do not fully explain.
- Items, map structure, enemy placement, ruins, and shortcuts carry story weight.
- Ambiguity is good when it invites investigation.
- Confusion is bad when it hides basic player goals or mechanics.

## Guidance

The player can be guided through:

- Landmarks visible before they are reachable.
- Locked doors and suspicious blocked routes.
- Enemy difficulty gradients.
- NPC hints with partial truth.
- Light, darkness, occlusion, and reveal.
- Repeated symbols, terrain patterns, and environmental contrast.
- Shortcuts that make the world easier to understand after discovery.

Avoid explicit objective markers unless a later design decision requires them.

## Map Shape

- The full game should feel huge and interconnected.
- The first demo should be small and dense.
- Routes should fold back on themselves through shortcuts.
- The world is side-view only, with routes shaped by platforms, drops, climbs,
  doors, ledges, and vertical/horizontal shortcuts.
- Navigation should be understandable enough to support simple platform-graph
  pathfinding for enemies and bosses.
- Bosses or minibosses can act as gates to new regions.
- Rest points should feel valuable and strategically placed.
- Every major area should have a readable identity, not just a color palette.
- Darkness and light can shape navigation, danger, and mood, but should not hide
  the basic rules of a fight.

## Boss And Enemy Placement

- Enemies should teach behaviors before bosses test them.
- A boss arena should support the boss pattern, not just contain it.
- Cheap surprise damage should be rare and intentional.
- Dangerous spaces should be readable before they are lethal.

## NPC Role

NPCs can:

- Suggest a direction.
- Hint at a danger.
- Reveal a local superstition or contradiction.
- React to world flags.
- Give partial context for a place.

NPCs should not:

- Explain the whole plot.
- Mark exact objectives.
- Solve navigation for the player.
- Deliver long exposition as the main way to understand the world.
