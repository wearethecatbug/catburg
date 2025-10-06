export const MovementEvents = {
    VELOCITY_CHANGED: 'movement:velocity:changed',
    SPEED_CHANGED: 'movement:speed:changed',
    STARTED: 'movement:started',
    STOPPED: 'movement:stopped',
    JUMP_STARTED: 'movement:jump:started',
    JUMP_ENDED: 'movement:jump:ended',
    LANDED: 'movement:landed',
} as const;

export const StateEvents = {
    STATE_CHANGED: 'state:changed',
    POSITION_CHANGED: 'position:changed',
    DIRECTION_CHANGED: 'direction:changed',
} as const;

export const PlayerEvents = {
    MOVING: 'player:moving',
    IDLE: 'player:idle',
    JUMP: 'player:jump',
} as const;

export type MovementEventType = typeof MovementEvents[keyof typeof MovementEvents];
export type StateEventType = typeof StateEvents[keyof typeof StateEvents];
export type PlayerEventType = typeof PlayerEvents[keyof typeof PlayerEvents];

