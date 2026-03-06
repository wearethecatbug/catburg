# PixiJS Platformer Actor System Documentation

## Overview

A compositional actor system for PixiJS platformer games built with TypeScript. The architecture uses factory patterns, event-driven communication, and clean separation of concerns between **Models** (data), **Views** (rendering), **Controllers** (logic), and **Events** (communication).

## Architecture Principles

### Factory-Based Creation
Actors are created through factories with declarative configuration:
```typescript
const actor = ActorFactory.createPlayerActor({
    spritesheet: 'doggy',
    speed: 150,
    initialPosition: { x: 400, y: 500 },
    keyboardController: keyboardControllerSingleton,
    animationConfigs: {
        Idle: { fps: 8, loop: true },
        Walk: { fps: 12, loop: true },
    },
});
```

### Separation of Concerns
- **Model**: Stores state data, emits events on changes
- **View**: Handles rendering, sprite manipulation, animation playback
- **Controller**: Implements behavior logic (movement, physics, input)
- **Actor**: Orchestrates Model + View + Controllers with dirty-check sync

### Event-Driven Actions
Controllers emit events for actions (move, jump), Actor reacts:
```typescript
// MovementController emits events
move(direction) {
    this.movementModel.setVelocity(...);
    this.emitEvent(PlayerEvents.MOVING, { horizontal: direction });
}

// Actor listens and updates animation
model.addEventListener(PlayerEvents.MOVING, () => {
    this.model.setState('Walk');
});
```

---

## Core Systems

### Event System (`core/`)

#### `EventTypes`
Centralized event constants for type safety.

**MovementEvents**:
- `VELOCITY_CHANGED` - Velocity updated
- `SPEED_CHANGED` - Base speed changed
- `MAX_SPEED_CHANGED` - Max speed limit changed
- `STARTED` - Movement started
- `STOPPED` - Movement stopped
- `JUMP_STARTED` - Jump initiated
- `JUMP_ENDED` - Jump completed
- `LANDED` - Actor landed on ground

**StateEvents**:
- `STATE_CHANGED` - Animation state changed
- `POSITION_CHANGED` - Position updated
- `DIRECTION_CHANGED` - Direction changed

**PlayerEvents**:
- `MOVING` - Player is moving
- `IDLE` - Player is idle
- `JUMP` - Player jumped

**Usage**:
```typescript
import {PlayerEvents} from '../core/EventTypes';
this.emitEvent(PlayerEvents.MOVING, { horizontal: direction });
```

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
Extends `EventDispatcher`, provides model composition with class-based keys:

**Methods**:
- `addModel<T>(model)` - Add sub-model (uses constructor as key)
- `removeModel<T>(modelClass)` - Remove sub-model by class
- `getModel<T>(modelClass)` - Retrieve typed sub-model by class
- `hasModel<T>(modelClass)` - Check if sub-model exists by class
- `emitChange<T>(type, data?)` - Emit change event
- `destroy()` - Cleanup (removes sub-models and listeners)

**Usage**:
```typescript
const actorModel = new ActorModel({...});
actorModel.addModel(new MovementModel({...}));
const movement = actorModel.getModel(MovementModel);
```

#### `ActorModel`
Stores basic actor state.

**Properties**:
- `position: {x, y}` - Actor position
- `direction: Direction` - Facing direction (Left/Right)
- `state: EntityAnimationState` - Current animation state

**Events**:
- `StateEvents.POSITION_CHANGED` - data: `{x, y}`
- `StateEvents.DIRECTION_CHANGED` - data: `Direction`
- `StateEvents.STATE_CHANGED` - data: `{state, previousState}`

**Methods**:
- `setPosition(x, y)` - Update position (emits event)
- `setDirection(direction)` - Update direction (emits event)
- `setState(state)` - Update animation state (emits event)

#### `MovementModel`
Stores horizontal movement state (platformer-specific).

**Properties**:
- `velocity: {x, y}` - Current velocity (Y unused in platformer)
- `speed: number` - Horizontal movement speed
- `maxSpeed: number` - Maximum velocity cap
- `isMoving: boolean` - Movement status

**Events**:
- `MovementEvents.VELOCITY_CHANGED` - data: `{x, y}`
- `MovementEvents.SPEED_CHANGED` - data: `number`
- `MovementEvents.MAX_SPEED_CHANGED` - data: `number`
- `MovementEvents.STARTED` - data: `{isMoving: true}`
- `MovementEvents.STOPPED` - data: `{isMoving: false}`

**Methods**:
- `setVelocity(x, y)` - Set velocity (clamped to maxSpeed)
- `setSpeed(speed)` - Set base speed
- `setMaxSpeed(maxSpeed)` - Set max velocity
- `stop()` - Set velocity to zero

#### `PhysicsModel`
Stores jump and gravity state for platformer physics.

**Properties**:
- `gravity: number` - Gravity acceleration (default 980 px/s²)
- `jumpForce: number` - Jump velocity (default -400 px/s upward)
- `isGrounded: boolean` - On ground or in air
- `verticalVelocity: number` - Current fall/jump speed

**Events**:
- `PlayerEvents.JUMP` - Jump initiated
- `MovementEvents.LANDED` - data: `{isGrounded: boolean}`
- `MovementEvents.VELOCITY_CHANGED` - data: `{vy}`

**Methods**:
- `jump()` - Apply jump force (only when grounded)
- `setGrounded(grounded)` - Update grounded state
- `setVerticalVelocity(vy)` - Update vertical velocity

---

### View System (`views/`)

#### `ActorView`
Wraps PixiJS `AnimatedSprite` for rendering with animation configuration.

**Properties**:
- `sprite: AnimatedSprite` - Public access to sprite

**Methods**:
- `setAnimationConfig(state, config)` - Configure FPS/loop for animation state
- `setPosition(x, y)` - Update sprite position
- `getPosition()` - Get current position
- `setDirection(direction)` - Flip sprite based on direction
- `setState(state)` - Change animation state (applies configured FPS/loop)
- `setScale(x, y)` - Scale sprite (preserves direction)
- `setAlpha(alpha)` - Set transparency
- `setVisible(visible)` - Show/hide sprite
- `destroy()` - Cleanup

**Animation Configuration**:
```typescript
view.setAnimationConfig('Walk', { fps: 12, loop: true });
// When setState('Walk') is called, animation plays at 12 FPS
```

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
    animationConfigs?: Partial<Record<EntityAnimationState, AnimationConfig>>,
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
    animationConfigs: {
        Idle: { fps: 8, loop: true },
        Walk: { fps: 12, loop: true },
    },
});
```

#### `ActorFactory`
Unified factory for creating complete actors with all components.

**Methods**:

**`createStaticActor(config)`** - Non-moving actors:
```typescript
const wormActor = ActorFactory.createStaticActor({
    spritesheet: 'monsterWorm',
    nameMap: WORM_ANIMATION_NAME_MAP,
    initialPosition: { x: 400, y: 500 },
    direction: Direction.Left,
    alignToBottom: true,
});
```

**`createMobileActor(config)`** - Actors with movement:
```typescript
const mobileActor = ActorFactory.createMobileActor({
    spritesheet: 'entityName',
    nameMap: ANIMATION_NAME_MAP,
    initialPosition: { x: 400, y: 500 },
    speed: 150,
    maxSpeed: 300,
});
```

**`createPlayerActor(config)`** - Player-controlled actors with physics:
```typescript
const playerActor = ActorFactory.createPlayerActor({
    spritesheet: 'doggy',
    nameMap: DOG_ANIMATION_NAME_MAP,
    initialPosition: { x: 400, y: 500 },
    direction: Direction.Right,
    alignToBottom: true,
    speed: 150,
    keyboardController: keyboardControllerSingleton,
    sceneBounds: { width: 800, height: 600 },
    animationConfigs: {
        Idle: { fps: 8, loop: true },
        Walk: { fps: 12, loop: true },
    },
});
```

**Features**:
- Loads spritesheets from Assets by string identifier
- Auto-wires View + Model + Controllers
- Configures animation speeds per state
- Player actors include PhysicsModel + GravityController + PlayerController

---

### Controller System (`controllers/`)

#### `IController` (interface)
Contract for all controllers.

**Properties**:
- `priority: number` - Execution order (lower = earlier, 0 is highest)

**Methods**:
- `init(actor: Actor)` - Called when attached to actor
- `update(delta)` - Called each frame with deltaMS
- `destroy()` - Cleanup when removed

#### `MovementController`
Handles horizontal velocity-based movement for platformers.

**Constructor**: `new MovementController(priority = 100)`

**Methods**:
- `init(actor)` - Validates ActorModel + MovementModel exist
- `setSceneBounds(width, height)` - Set horizontal movement boundaries
- `move(direction)` - Set horizontal velocity, emit MOVING event
- `stop()` - Stop movement, emit IDLE event
- `update(delta)` - Apply horizontal velocity to X position
- `emitEvent(type, data?)` - Protected: emit events via model

**Events Emitted**:
- `PlayerEvents.MOVING` - When movement starts
- `PlayerEvents.IDLE` - When movement stops

**Requirements**:
- Actor must have `ActorModel`
- ActorModel must have `MovementModel` sub-model

**Behavior**:
- Converts direction to horizontal velocity (direction * speed)
- Auto-updates actor direction on movement
- Clamps X position to scene bounds (if configured)
- Y position unchanged (handled by GravityController)
- Uses delta time for frame-independent movement

#### `GravityController`
Applies gravity and handles ground collision for platformer physics.

**Constructor**: `new GravityController(groundY)`

**Priority**: 90 (runs before MovementController)

**Methods**:
- `init(actor)` - Validates ActorModel + PhysicsModel exist
- `update(delta)` - Apply gravity, update Y position, check ground collision

**Behavior**:
- Applies gravity acceleration to vertical velocity
- Updates Y position based on vertical velocity
- Detects ground collision (Y >= groundY)
- Sets grounded state when landing
- Resets vertical velocity to 0 on landing

**Requirements**:
- Actor must have `ActorModel`
- ActorModel must have `PhysicsModel` sub-model

#### `PlayerController`
Extends `MovementController` with keyboard input and jump.

**Constructor**: `new PlayerController(keyboardController, priority = 50)`

**Methods**:
- `setActive(active)` - Enable/disable player control
- `update(delta)` - Handle input then call super.update()
- `handleInput()` - Process keyboard, trigger movement/jump

**Input Mapping**:
- **Horizontal**: ArrowLeft/A (Left), ArrowRight/D (Right)
- **Jump**: Space, ArrowUp, W (only when grounded)

**Behavior**:
- Calls `move(direction)` → MovementController emits MOVING
- Calls `stop()` → MovementController emits IDLE
- Calls `physicsModel.jump()` → PhysicsModel emits JUMP
- Pure input translation layer, doesn't emit events directly

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

**Constructor**:
- `new Actor(view: ActorView, model: ActorModel)` - Compositional approach

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
- `update(delta)` - Updates all controllers in priority order, then syncs model to view
- `destroy()` - Cleanup controllers, model, view

**Model-View Sync** (Dirty Checking):
- `syncModelToView()` - Called after controllers update
- Checks if position/direction/state changed since last frame
- Only updates view if values changed (performance optimization)
- No event listeners needed for simple state sync

**Event Listeners** (Action Events):
- `setupPlayerEventListeners()` - Listens to PlayerEvents (MOVING, IDLE, JUMP)
- Updates animation state based on player actions
- Events used for actions, not for simple state sync

**Controller Execution**:
- Controllers sorted by priority (cached in `sortedControllers`)
- Lower priority number = executes first
- Re-sorts on add/remove controller

---

## Current Implementation Status

### Working Features
✅ Event system with type-safe constants (MovementEvents, StateEvents, PlayerEvents)  
✅ Compositional model system with class-based sub-model keys  
✅ ActorFactory for unified actor creation with spritesheet identifiers  
✅ ViewFactory with animation speed configuration support  
✅ MovementController with horizontal-only movement (platformer)  
✅ GravityController with jump and gravity physics  
✅ PlayerController with keyboard input (WASD + Arrows + Space for jump)  
✅ Actor orchestration with priority-based controller execution  
✅ Dirty-check model-to-view sync (no event listeners needed)  
✅ Event-driven animation changes (controllers emit, Actor listens)  
✅ Scene bounds clamping (horizontal only)  
✅ Configurable animation FPS per state  
✅ TypeScript strict mode - no `any` types  

### Platformer Features
✅ Horizontal movement (A/D or Left/Right arrows)  
✅ Jump with gravity (Space, W, or ArrowUp)  
✅ Ground collision detection  
✅ Grounded state tracking  
✅ Animation state auto-switches (Idle ↔ Walk)  
✅ Animation speed configuration (Idle: 8 FPS, Walk: 12 FPS)  

### Architecture Improvements
✅ Factory pattern enforced - all actors created via ActorFactory  
✅ Events emitted by controllers where actions occur (not in PlayerController)  
✅ Clean separation: PlayerController = input translation only  
✅ Type-safe event names via EventTypes constants  
✅ Class-based model composition (no magic strings)  
✅ Dirty-check sync for performance (events reserved for actions)  

---

## Usage Examples

### Creating a Player-Controlled Actor (Current API)
```typescript
const dogActor = ActorFactory.createPlayerActor({
    spritesheet: 'doggy',
    nameMap: DOG_ANIMATION_NAME_MAP,
    initialPosition: { x: 400, y: 500 },
    direction: Direction.Right,
    alignToBottom: true,
    speed: 150,
    keyboardController: keyboardControllerSingleton,
    sceneBounds: { width: 800, height: 600 },
    animationConfigs: {
        Idle: { fps: 8, loop: true },
        Walk: { fps: 12, loop: true },
    },
});

scene.addActor(dogActor);
```

### Creating a Static Actor
```typescript
const wormActor = ActorFactory.createStaticActor({
    spritesheet: 'monsterWorm',
    nameMap: WORM_ANIMATION_NAME_MAP,
    initialPosition: { x: 600, y: 500 },
    direction: Direction.Left,
    alignToBottom: true,
});

scene.addActor(wormActor);
```

### Creating a Mobile Actor (Without Player Input)
```typescript
const enemyActor = ActorFactory.createMobileActor({
    spritesheet: 'enemy',
    nameMap: ENEMY_ANIMATION_NAME_MAP,
    initialPosition: { x: 300, y: 500 },
    speed: 100,
    maxSpeed: 200,
});

// Add custom AI controller
const aiController = new AIController(80);
enemyActor.addController('ai', aiController);

scene.addActor(enemyActor);
```

---

## Design Patterns Used

- **Factory Pattern**: ActorFactory and ViewFactory for declarative object creation
- **Composite Pattern**: Actor composed of Model + View + Controllers
- **Observer Pattern**: Event system for component communication
- **Strategy Pattern**: Controllers implement different behaviors (Movement, Gravity, Player)
- **Dependency Injection**: Controllers and models injected into Actor

---

## Key Design Decisions

### 1. Dirty-Check Sync vs Event-Based Sync
Model-to-view synchronization uses dirty checking in update cycle instead of event listeners:
- **Performance**: Only checks once per frame, no event dispatch overhead
- **Simplicity**: No need to manage event subscriptions
- **Events Reserved for Actions**: Jump, attack, state changes - meaningful game events

### 2. Class-Based Model Keys
Sub-models retrieved by constructor instead of strings:
```typescript
// Type-safe, autocomplete-friendly
actorModel.getModel(MovementModel)

// Instead of error-prone strings
actorModel.getModel('movement')
```

### 3. Controllers Emit Events
Controllers emit events where actions occur, not in input layer:
- `MovementController.move()` → emits `PlayerEvents.MOVING`
- `PhysicsModel.jump()` → emits `PlayerEvents.JUMP`
- `PlayerController` → pure input translation, no events

### 4. Spritesheet String Identifiers
Factory accepts spritesheet names instead of loaded objects:
```typescript
// Clean API - factory loads internally
ActorFactory.createPlayerActor({ spritesheet: 'doggy', ... })

// Instead of requiring pre-loaded spritesheets
ActorFactory.createPlayerActor({ spritesheet: doggySheet, ... })
```

### 5. Animation Configuration as Record
Animation configs use Record keyed by state instead of arrays:
```typescript
// Type-safe, readable
animationConfigs: {
    Idle: { fps: 8, loop: true },
    Walk: { fps: 12, loop: true },
}

// Instead of arrays with redundant state property
animationConfigs: [
    { state: 'Idle', fps: 8, loop: true },
]
```

---

## Performance Considerations

- **Dirty Checking**: Model-view sync happens once per frame, minimal overhead
- **Controller Priority**: Critical controllers run first (Gravity before Movement)
- **Event Pooling**: GameEvent instances created on-demand, minimal allocation
- **Animation Speed**: Configured per-state to match visual expectations
- **Delta Time**: All movement uses delta for consistent speed across frame rates

---

## Extending the System

### Adding a New Controller
```typescript
export class AIController implements IController {
    readonly priority: number = 70; // Between Gravity and Movement

    init(actor: Actor): void {
        // Setup references to models
    }

    update(delta: number): void {
        // Implement AI logic
        // Call movement controller methods
    }

    destroy(): void {
        // Cleanup
    }
}
```

### Adding a New Model
```typescript
export class HealthModel extends Model {
    private _health: number;
    private _maxHealth: number;

    takeDamage(amount: number): void {
        this._health -= amount;
        this.emitChange(GameEvents.DAMAGE_TAKEN, { health: this._health, amount });
    }
}

// Usage
actorModel.addModel(new HealthModel({ maxHealth: 100 }));
```

### Adding a New Animation State
```typescript
// 1. Add to EntityAnimationState type
export type EntityAnimationState = 'Idle' | 'Walk' | 'Jump' | 'Attack';

// 2. Configure in actor creation
animationConfigs: {
    Idle: { fps: 8, loop: true },
    Walk: { fps: 12, loop: true },
    Jump: { fps: 10, loop: false },
}

// 3. Trigger in controller or event listener
actor.setState('Jump');
```

