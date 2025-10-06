# PixiJS Actor System Documentation

## Overview

This is a compositional actor system for PixiJS games built with TypeScript. The architecture separates concerns into **Models** (data), **Views** (rendering), **Controllers** (logic), and **Events** (communication).

## Architecture Principles

### Separation of Concerns
- **Model**: Stores state data, emits change events
- **View**: Handles rendering, sprite manipulation
- **Controller**: Implements behavior logic (movement, AI, player input)
- **Actor**: Orchestrates Model + View + Controllers

### Compositional Design
Actors are built by composing components:
```typescript
const actor = new Actor(view, model);
actor.addController('movement', movementController);
actor.addController('player', playerController);
```

### Event-Driven Communication
Components communicate via events, not direct coupling:
```typescript
model.addEventListener('position:changed', (event) => {
    view.setPosition(event.data.x, event.data.y);
});
```

---

## Core Systems

### Event System (`core/`)

#### `EventDispatcher`
Base class providing pub-sub pattern for events.

**Methods**:
- `addEventListener<T>(type, callback, options?)` - Subscribe to events
- `removeEventListener<T>(type, callback)` - Unsubscribe
- `dispatchEvent<T>(event)` - Emit event to listeners
- `removeAllListeners(type?)` - Cleanup
- `hasListeners(type)` - Check if event has listeners
- `getListenerCount(type)` - Count listeners

**Features**:
- TypeScript generics for type-safe event data
- `once` option for one-time listeners
- Safe iteration during dispatch

#### `GameEvent<T>`
Event wrapper containing:
- `type: string` - Event identifier
- `data: T` - Event payload (type-safe)
- `timestamp: number` - When event occurred

---

### Model System (`models/`)

#### `Model` (abstract base)
Extends `EventDispatcher`, provides model composition:

**Methods**:
- `addModel(name, model)` - Add sub-model
- `removeModel(name)` - Remove sub-model
- `getModel<T>(name)` - Retrieve typed sub-model
- `hasModel(name)` - Check if sub-model exists
- `emitChange<T>(type, data?)` - Emit change event
- `destroy()` - Cleanup (removes sub-models and listeners)

**Usage**:
```typescript
const actorModel = new ActorModel({...});
actorModel.addModel('movement', new MovementModel({...}));
```

#### `ActorModel`
Stores basic actor state.

**Properties**:
- `position: {x, y}` - Actor position
- `direction: Direction` - Facing direction (Left/Right)
- `state: EntityAnimationState` - Current animation state

**Events**:
- `position:changed` - data: `{x, y}`
- `direction:changed` - data: `Direction`
- `state:changed` - data: `{state, previousState}`

**Methods**:
- `setPosition(x, y)` - Update position (emits event)
- `setDirection(direction)` - Update direction (emits event)
- `setState(state)` - Update animation state (emits event)

#### `MovementModel`
Stores movement-related state.

**Properties**:
- `velocity: {x, y}` - Current velocity
- `speed: number` - Movement speed
- `maxSpeed: number` - Maximum velocity cap
- `isMoving: boolean` - Movement status

**Events**:
- `velocity:changed` - data: `{x, y}`
- `speed:changed` - data: `number`
- `maxSpeed:changed` - data: `number`
- `movement:started` - data: `{isMoving: true}`
- `movement:stopped` - data: `{isMoving: false}`

**Methods**:
- `setVelocity(x, y)` - Set velocity (clamped to maxSpeed)
- `setSpeed(speed)` - Set base speed
- `setMaxSpeed(maxSpeed)` - Set max velocity
- `stop()` - Set velocity to zero

---

### View System (`views/`)

#### `ActorView`
Wraps PixiJS `AnimatedSprite` for rendering.

**Properties**:
- `sprite: AnimatedSprite` - Public access to sprite

**Methods**:
- `setPosition(x, y)` - Update sprite position
- `getPosition()` - Get current position
- `setDirection(direction)` - Flip sprite based on direction
- `setState(state)` - Change animation state
- `setScale(x, y)` - Scale sprite (preserves direction)
- `setAlpha(alpha)` - Set transparency
- `setVisible(visible)` - Show/hide sprite
- `destroy()` - Cleanup

**Direction Handling**:
- Tracks `baseScaleX` for proper flipping
- `Direction.Left` flips sprite horizontally
- `Direction.Right` uses original orientation

---

### Factory System (`factories/`)

#### `ViewFactory`
Static factory for creating views from configuration.

**Method**: `createActorView(config)`

**Config**:
```typescript
{
    spritesheet: Spritesheet,
    animations: Record<string | number, Texture[]>,
    nameMap?: AnimationNameMap,
    initialState?: EntityAnimationState,
    direction?: Direction,
    alignToBottom?: boolean,
    anchorX?: number,
    anchorY?: number,
}
```

**Usage**:
```typescript
const view = ViewFactory.createActorView({
    spritesheet: doggySheet,
    animations: doggySheet.animations,
    nameMap: DOG_ANIMATION_NAME_MAP,
    initialState: 'Idle',
    alignToBottom: true,
    direction: Direction.Right,
});
```

---

### Controller System (`controllers/`)

#### `IController` (interface)
Contract for all controllers.

**Properties**:
- `priority: number` - Execution order (lower = earlier, 0 is highest)

**Methods**:
- `init(actor)` - Called when attached to actor
- `update(delta)` - Called each frame with deltaMS
- `destroy()` - Cleanup when removed

#### `MovementController`
Handles velocity-based movement.

**Constructor**: `new MovementController(priority = 100)`

**Methods**:
- `init(actor)` - Validates ActorModel + MovementModel exist
- `setSceneBounds(width, height)` - Set movement boundaries
- `move(direction, vertical?)` - Set velocity based on direction
- `stop()` - Stop movement (velocity = 0)
- `update(delta)` - Apply velocity to position
- `emitEvent(type, data?)` - Protected: emit events via model

**Requirements**:
- Actor must have `ActorModel`
- ActorModel must have `MovementModel` sub-model

**Behavior**:
- Converts direction to velocity (direction * speed)
- Auto-updates actor direction on horizontal movement
- Clamps position to scene bounds (if configured)
- Uses delta time for frame-independent movement

#### `PlayerController`
Extends `MovementController` with keyboard input.

**Constructor**: `new PlayerController(keyboardController, priority = 50)`

**Methods**:
- `setActive(active)` - Enable/disable player control
- `update(delta)` - Handle input then call super.update()
- `handleInput()` - Process keyboard and update movement

**Input Mapping**:
- **Horizontal**: ArrowLeft/A (Left), ArrowRight/D (Right)
- **Vertical**: ArrowUp/W (Up), ArrowDown/S (Down)

**Events Emitted**:
- `player:moving` - data: `{horizontal, vertical}`
- `player:idle` - no data

**Additional Behavior**:
- Directly sets actor state to 'Walk' when moving
- Directly sets actor state to 'Idle' when stopped
- Calls `stop()` when no input detected

---

### Actor System (`scene/`)

#### `Direction` (enum)
```typescript
enum Direction {
    Left = -1,
    Right = 1,
}
```

#### `Actor`
Core entity class orchestrating Model + View + Controllers.

**Constructors** (overloaded):
1. `new Actor(view, model)` - New compositional approach
2. `new Actor(options)` - Legacy backward-compatible approach

**Properties**:
- `view: ActorView` - Rendering component
- `model: ActorModel` - State component
- `state` (getter) - Current animation state
- `direction` (getter) - Current direction

**Controller Management**:
- `addController(name, controller)` - Attach controller, auto-init, sort by priority
- `removeController(name)` - Detach and destroy controller
- `getController<T>(name)` - Get typed controller reference
- `hasController(name)` - Check controller existence

**State Management** (delegates to model):
- `setState(state)` - Change animation state
- `setDirection(direction)` - Change facing direction
- `setPosition(x, y)` - Update position

**Lifecycle**:
- `update(delta)` - Updates all controllers in priority order
- `destroy()` - Cleanup controllers, model, view

**Model-View Sync**:
- `setupModelListeners()` - Auto-syncs model changes to view:
  - `position:changed` → `view.setPosition()`
  - `direction:changed` → `view.setDirection()`
  - `state:changed` → `view.setState()`

**Controller Execution**:
- Controllers sorted by priority (cached in `sortedControllers`)
- Lower priority number = executes first
- Re-sorts on add/remove controller

---

## Current Implementation Status

### Working Features
✅ Event system with pub-sub pattern  
✅ Compositional model system with sub-models  
✅ View factory for creating sprite-based views  
✅ Movement controller with velocity-based physics  
✅ Player controller with keyboard input (WASD + Arrows)  
✅ Actor orchestration with priority-based controller execution  
✅ Automatic model-to-view synchronization  
✅ Scene bounds clamping  
✅ Backward compatibility with legacy Actor constructor  

### Current Issues

#### 1. **Inconsistent Actor Creation**
- Dog uses `ViewFactory` + new Actor system
- Worm uses legacy `Actor(options)` constructor
- No unified factory for complete actor creation

#### 2. **View Creation in Actor**
- Legacy constructor creates view internally
- Violates single responsibility principle
- Should only be created via factory

#### 3. **Unnecessary Event Listeners in Actor**
- `setupModelListeners()` creates event subscriptions
- Simple sync could happen in `update()` with dirty checking
- Events better suited for action triggers (jump, attack)

#### 4. **Animation State Changed in Controller**
- `PlayerController` directly sets `actorModel.setState('Walk')`
- Violates separation: controllers shouldn't manage view state
- Should emit events, let View/Actor handle animation

#### 5. **String-Based Model Keys**
- `addModel('movement', new MovementModel())` uses magic strings
- Type-unsafe, prone to typos
- Should use class constructor as key

#### 6. **No Event Type Constants**
- Event types scattered as strings: `'player:moving'`, `'velocity:changed'`
- No central definition, hard to track
- Should have `MovementEvents`, `StateEvents` enums/constants

#### 7. **Controller Emits via Model**
- `emitEvent()` dispatches through `actorModel`
- Controllers could be EventDispatchers themselves
- Current approach works but couples controller to model

#### 8. **TypeScript `any` in Controller Interface**
- `init(actor: any)` loses type safety
- Should be `init(actor: Actor)` or typed interface

#### 9. **Vertical Movement in Platformer**
- Current system supports 4-directional movement
- Platformer needs horizontal + jump
- No gravity or jump controller

#### 10. **Animation Speed Issues**
- Idle animation too fast
- Walk animation not synced with movement speed
- No framerate configuration based on action

---

## Usage Examples

### Creating a Player-Controlled Actor
```typescript
const dogView = ViewFactory.createActorView({
    spritesheet: doggySheet,
    animations: doggySheet.animations,
    nameMap: DOG_ANIMATION_NAME_MAP,
    initialState: 'Idle',
    alignToBottom: true,
    direction: Direction.Right,
});

const dogModel = new ActorModel({
    position: { x: 100, y: 400 },
    direction: Direction.Right,
    state: 'Idle',
});
dogModel.addModel('movement', new MovementModel({ speed: 150 }));

const dogActor = new Actor(dogView, dogModel);

const playerController = new PlayerController(keyboardControllerSingleton, 50);
playerController.setSceneBounds(screenWidth, screenHeight);
dogActor.addController('player', playerController);

scene.addActor(dogActor);
```

### Creating a Static Actor (Legacy)
```typescript
const wormActor = new Actor({
    asset: wormSheet,
    animations: wormSheet.animations,
    nameMap: WORM_ANIMATION_NAME_MAP,
    initialState: 'Idle',
    alignToBottom: true,
    direction: Direction.Left,
});
scene.addActor(wormActor);
```

---

## Design Patterns Used

- **Composite Pattern**: Actor composed of Model + View + Controllers
- **Observer Pattern**: Event system for component communication
- **Factory Pattern**: ViewFactory creates views from config
- **Strategy Pattern**: Controllers implement different behaviors
- **Dependency Injection**: Controllers and models injected into Actor

---

## Future Improvements

See `PLATFORMER_REFACTOR_PLAN.md` for upcoming changes:
- ActorFactory for unified actor creation
- Event type constants/enums
- Class-based model keys
- Jump controller with gravity
- Animation framerate based on movement speed
- Removal of unnecessary event listeners
- TypeScript strict typing throughout

