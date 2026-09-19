export type PresentationMode =
  | "PLAYING" | "WRONG" | "LONG_IDLE" | "PET_PROMPT" | "PET_MISSED"
  | "PET_NORMAL" | "PET_NORMAL_LEAVE_GRACE" | "PET_PROMPT_SUCCESS"
  | "HINT_ATTENTION" | "TERMINAL_STORED_HINTS_PENDING" | "STORED_HINTS" | "HISTORY" | "HINT_DIALOG"
  | "HINT_SUCCESS_HANDOFF" | "HINT_REWARD" | "WON" | "SURRENDERED";
export type PresentationSurface = "none" | "stored-hints" | "history" | "hint-dialog" | "hint-reward";
export type PresentationModality = "pointer" | "keyboard" | "touch";
export type PresentationTimerKind =
  | "idle" | "prompt-due" | "prompt-expiry" | "prompt-missed-settle"
  | "pet-normal-settle" | "pet-normal-leave-grace" | "pet-prompt-success-settle"
  | "stored-open" | "stored-close" | "hint-success" | "reward-expiry";
export type PresentationTimerToken = Readonly<{ roundEpoch: number; stateEpoch: number; kind: PresentationTimerKind; dueAt: number }>;
export type PublicAward = Readonly<{ factId: string; text: string }>;

type Common = Readonly<{
  roundEpoch: number; stateEpoch: number; updatedAt: number; inputRevision: number;
  idleStartedAt: number; promptAnchorAt: number; promptCount: 0 | 1 | 2;
  burstSequence: number; lastBurstAt: number | null; publicAwards: readonly PublicAward[];
  challengeIds: readonly string[];
}>;
type Visible<K extends PresentationTimerKind | null> = K extends PresentationTimerKind
  ? { visibility: "visible"; hiddenAt: null; timer: PresentationTimerToken & { kind: K }; suspended: null }
  : { visibility: "visible"; hiddenAt: null; timer: null; suspended: null };
type Hidden<K extends PresentationTimerKind | null> = K extends PresentationTimerKind
  ? { visibility: "hidden"; hiddenAt: number; timer: null; suspended: { kind: K; remainingMs: number } }
  : { visibility: "hidden"; hiddenAt: number; timer: null; suspended: null };
type Clock<K extends PresentationTimerKind | null> = Visible<K> | Hidden<K>;
type ActiveBase = "PLAYING" | "WRONG";
type HistoryBase = ActiveBase | "WON" | "SURRENDERED";
type StoredResumeMode = "PLAYING" | "WON" | "SURRENDERED";
type Awarded = readonly [PublicAward, ...PublicAward[]];
export type PresentationState = Common & (
  | ({ mode: "PLAYING"; surface: "none" } & Clock<"idle">)
  | ({ mode: "WRONG"; surface: "none" } & Clock<null>)
  | ({ mode: "LONG_IDLE"; surface: "none"; promptCount: 0 | 1 } & Clock<"prompt-due">)
  | ({ mode: "LONG_IDLE"; surface: "none"; promptCount: 2 } & Clock<null>)
  | ({ mode: "PET_PROMPT"; surface: "none"; promptId: 1 | 2; promptCount: 1 | 2 } & Clock<"prompt-expiry">)
  | ({ mode: "PET_MISSED"; surface: "none"; promptId: 1 | 2; promptCount: 1 | 2 } & Clock<"prompt-missed-settle">)
  | ({ mode: "PET_NORMAL"; surface: "none"; burstId: number; inputModality: PresentationModality } & Clock<"pet-normal-settle">)
  | ({ mode: "PET_NORMAL_LEAVE_GRACE"; surface: "none"; burstId: number; inputModality: "pointer" } & Clock<"pet-normal-leave-grace">)
  | ({ mode: "PET_PROMPT_SUCCESS"; surface: "none"; promptId: 1 | 2; promptCount: 1 | 2; burstId: number; inputModality: PresentationModality } & Clock<"pet-prompt-success-settle">)
  | ({ mode: "HINT_ATTENTION"; surface: "none"; resumeMode: "PLAYING"; inputModality: PresentationModality; publicAwards: readonly [] } & Clock<null>)
  | ({ mode: "HINT_ATTENTION"; surface: "none"; resumeMode: "PLAYING"; inputModality: "pointer" | "touch"; publicAwards: Awarded } & Clock<"stored-open">)
  | ({ mode: "TERMINAL_STORED_HINTS_PENDING"; surface: "none"; resumeMode: "WON" | "SURRENDERED"; inputModality: "pointer" | "touch"; publicAwards: Awarded } & Clock<"stored-open">)
  | ({ mode: "STORED_HINTS"; surface: "stored-hints"; resumeMode: StoredResumeMode; inputModality: PresentationModality; cardPhase: "open"; publicAwards: Awarded } & Clock<null>)
  | ({ mode: "STORED_HINTS"; surface: "stored-hints"; resumeMode: StoredResumeMode; inputModality: "pointer"; cardPhase: "closing"; publicAwards: Awarded } & Clock<"stored-close">)
  | ({ mode: "HISTORY"; surface: "history"; resumeMode: HistoryBase } & Clock<null>)
  | ({ mode: "HISTORY"; surface: "history"; resumeMode: "HINT_REWARD"; challengeId: string; award: PublicAward } & Clock<"reward-expiry">)
  | ({ mode: "HINT_DIALOG"; surface: "hint-dialog"; resumeMode: ActiveBase; challengeId: string } & Clock<null>)
  | ({ mode: "HINT_SUCCESS_HANDOFF"; surface: "hint-dialog"; resumeMode: ActiveBase; challengeId: string; award: PublicAward } & Clock<"hint-success">)
  | ({ mode: "HINT_REWARD"; surface: "hint-reward"; resumeMode: ActiveBase; challengeId: string; award: PublicAward } & Clock<"reward-expiry">)
  | ({ mode: "WON"; surface: "none" } & Clock<null>)
  | ({ mode: "SURRENDERED"; surface: "none" } & Clock<null>)
);
export type PresentationEvent =
  | { type: "ROUND_STARTED" | "VALID_WRONG_GUESS" | "ROUND_WON" | "ROUND_SURRENDERED"; roundEpoch: number }
  | { type: "INPUT_VALUE_CHANGED"; roundEpoch: number; inputRevision: number }
  | { type: "CAT_PET_START"; roundEpoch: number; modality: PresentationModality }
  | { type: "CAT_PET_END"; roundEpoch: number; stateEpoch: number }
  | { type: "SHOW_HINT_ENTER" | "SHOW_HINT_FOCUS" | "SHOW_HINT_TOUCH_START" | "SHOW_HINT_ACTIVATE" | "SHOW_HINT_LEAVE" | "STORED_HINTS_ESCAPE" | "HISTORY_TOGGLE" | "HISTORY_ACTIVITY" | "HISTORY_CLOSE" | "DOCUMENT_HIDDEN" | "DOCUMENT_VISIBLE"; roundEpoch: number }
  | { type: "HINT_DIALOG_OPEN" | "HINT_DIALOG_CLOSED"; roundEpoch: number; challengeId: string }
  | { type: "HINT_AWARDED"; roundEpoch: number; challengeId: string; award: PublicAward }
  | { type: "HINT_SUCCESS_COMPLETE_EARLY"; roundEpoch: number; challengeId: string; factId: string; cause: "close" | "escape" }
  | { type: "IDLE_EXPIRED" | "PET_PROMPT_DUE_EXPIRED" | "PET_PROMPT_EXPIRED" | "PET_MISSED_EXPIRED" | "PET_NORMAL_SETTLE_EXPIRED" | "PET_NORMAL_LEAVE_GRACE_EXPIRED" | "PET_PROMPT_SUCCESS_EXPIRED" | "STORED_OPEN_EXPIRED" | "STORED_CLOSE_EXPIRED" | "HINT_SUCCESS_EXPIRED" | "REWARD_EXPIRED"; token: PresentationTimerToken };

const kinds = new Set<PresentationTimerKind>(["idle", "prompt-due", "prompt-expiry", "prompt-missed-settle", "pet-normal-settle", "pet-normal-leave-grace", "pet-prompt-success-settle", "stored-open", "stored-close", "hint-success", "reward-expiry"]);
const modes = new Set<PresentationMode>(["PLAYING", "WRONG", "LONG_IDLE", "PET_PROMPT", "PET_MISSED", "PET_NORMAL", "PET_NORMAL_LEAVE_GRACE", "PET_PROMPT_SUCCESS", "HINT_ATTENTION", "TERMINAL_STORED_HINTS_PENDING", "STORED_HINTS", "HISTORY", "HINT_DIALOG", "HINT_SUCCESS_HANDOFF", "HINT_REWARD", "WON", "SURRENDERED"]);
const timerEventKinds: Record<string, PresentationTimerKind> = {
  IDLE_EXPIRED: "idle", PET_PROMPT_DUE_EXPIRED: "prompt-due", PET_PROMPT_EXPIRED: "prompt-expiry", PET_MISSED_EXPIRED: "prompt-missed-settle", PET_NORMAL_SETTLE_EXPIRED: "pet-normal-settle", PET_NORMAL_LEAVE_GRACE_EXPIRED: "pet-normal-leave-grace", PET_PROMPT_SUCCESS_EXPIRED: "pet-prompt-success-settle", STORED_OPEN_EXPIRED: "stored-open", STORED_CLOSE_EXPIRED: "stored-close", HINT_SUCCESS_EXPIRED: "hint-success", REWARD_EXPIRED: "reward-expiry",
};

function fail(): never { throw new TypeError("Invalid presentation state or event."); }
function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function finite(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(); return value; }
function positive(value: unknown): number { const n = finite(value); if (!Number.isSafeInteger(n) || n < 1) fail(); return n; }
function nonnegativeInteger(value: unknown): number { const n = finite(value); if (!Number.isSafeInteger(n)) fail(); return n; }
function string(value: unknown): string { if (typeof value !== "string" || value.length === 0) fail(); return value; }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) { const actual = Object.keys(value); if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(); }
function sameToken(left: PresentationTimerToken, right: PresentationTimerToken) { return left.roundEpoch === right.roundEpoch && left.stateEpoch === right.stateEpoch && left.kind === right.kind && left.dueAt === right.dueAt; }
function token(value: unknown): PresentationTimerToken { const raw = object(value); exactKeys(raw, ["roundEpoch", "stateEpoch", "kind", "dueAt"]); const kind = raw.kind; if (typeof kind !== "string" || !kinds.has(kind as PresentationTimerKind)) fail(); return { roundEpoch: positive(raw.roundEpoch), stateEpoch: positive(raw.stateEpoch), kind: kind as PresentationTimerKind, dueAt: finite(raw.dueAt) }; }
function award(value: unknown): PublicAward { const raw = object(value); exactKeys(raw, ["factId", "text"]); return { factId: string(raw.factId), text: string(raw.text) }; }
function isModality(value: unknown): value is PresentationModality { return value === "pointer" || value === "keyboard" || value === "touch"; }
function expectedTimer(mode: PresentationMode, raw: Record<string, unknown>): PresentationTimerKind | null {
  if (mode === "PLAYING") return "idle";
  if (mode === "LONG_IDLE") return raw.promptCount === 2 ? null : "prompt-due";
  if (mode === "PET_PROMPT") return "prompt-expiry";
  if (mode === "PET_MISSED") return "prompt-missed-settle";
  if (mode === "PET_NORMAL") return "pet-normal-settle";
  if (mode === "PET_NORMAL_LEAVE_GRACE") return "pet-normal-leave-grace";
  if (mode === "PET_PROMPT_SUCCESS") return "pet-prompt-success-settle";
  if (mode === "HINT_ATTENTION" || mode === "TERMINAL_STORED_HINTS_PENDING") return Array.isArray(raw.publicAwards) && raw.publicAwards.length === 0 ? null : "stored-open";
  if (mode === "STORED_HINTS") return raw.cardPhase === "closing" ? "stored-close" : null;
  if (mode === "HINT_SUCCESS_HANDOFF" || mode === "HINT_REWARD" || (mode === "HISTORY" && raw.resumeMode === "HINT_REWARD")) return mode === "HINT_SUCCESS_HANDOFF" ? "hint-success" : "reward-expiry";
  return null;
}
function validateState(value: unknown): PresentationState {
  const raw = object(value); const mode = raw.mode; if (typeof mode !== "string" || !modes.has(mode as PresentationMode)) fail();
  const m = mode as PresentationMode; const surface: Record<PresentationMode, PresentationSurface> = { PLAYING: "none", WRONG: "none", LONG_IDLE: "none", PET_PROMPT: "none", PET_MISSED: "none", PET_NORMAL: "none", PET_NORMAL_LEAVE_GRACE: "none", PET_PROMPT_SUCCESS: "none", HINT_ATTENTION: "none", TERMINAL_STORED_HINTS_PENDING: "none", STORED_HINTS: "stored-hints", HISTORY: "history", HINT_DIALOG: "hint-dialog", HINT_SUCCESS_HANDOFF: "hint-dialog", HINT_REWARD: "hint-reward", WON: "none", SURRENDERED: "none" };
  if (raw.surface !== surface[m]) fail(); const common = ["mode", "surface", "roundEpoch", "stateEpoch", "updatedAt", "inputRevision", "idleStartedAt", "promptAnchorAt", "promptCount", "burstSequence", "lastBurstAt", "publicAwards", "challengeIds", "visibility", "hiddenAt", "timer", "suspended"];
  const extras: Record<PresentationMode, readonly string[]> = { PLAYING: [], WRONG: [], LONG_IDLE: [], PET_PROMPT: ["promptId"], PET_MISSED: ["promptId"], PET_NORMAL: ["burstId", "inputModality"], PET_NORMAL_LEAVE_GRACE: ["burstId", "inputModality"], PET_PROMPT_SUCCESS: ["promptId", "burstId", "inputModality"], HINT_ATTENTION: ["resumeMode", "inputModality"], TERMINAL_STORED_HINTS_PENDING: ["resumeMode", "inputModality"], STORED_HINTS: ["resumeMode", "inputModality", "cardPhase"], HISTORY: raw.resumeMode === "HINT_REWARD" ? ["resumeMode", "challengeId", "award"] : ["resumeMode"], HINT_DIALOG: ["resumeMode", "challengeId"], HINT_SUCCESS_HANDOFF: ["resumeMode", "challengeId", "award"], HINT_REWARD: ["resumeMode", "challengeId", "award"], WON: [], SURRENDERED: [] };
  exactKeys(raw, [...common, ...extras[m]]); const roundEpoch = positive(raw.roundEpoch), stateEpoch = positive(raw.stateEpoch), updatedAt = finite(raw.updatedAt), idleStartedAt = finite(raw.idleStartedAt), promptAnchorAt = finite(raw.promptAnchorAt), inputRevision = nonnegativeInteger(raw.inputRevision), burstSequence = nonnegativeInteger(raw.burstSequence);
  if (idleStartedAt > updatedAt || promptAnchorAt > updatedAt || raw.promptCount !== 0 && raw.promptCount !== 1 && raw.promptCount !== 2) fail();
  const lastBurstAt = raw.lastBurstAt === null ? null : finite(raw.lastBurstAt); if (lastBurstAt !== null && lastBurstAt > updatedAt) fail();
  if (!Array.isArray(raw.publicAwards) || !Array.isArray(raw.challengeIds)) fail(); const publicAwards = raw.publicAwards.map(award), challengeIds = raw.challengeIds.map(string); if (new Set(publicAwards.map((item) => item.factId)).size !== publicAwards.length || new Set(challengeIds).size !== challengeIds.length) fail();
  if (raw.visibility !== "visible" && raw.visibility !== "hidden") fail(); const expected = expectedTimer(m, raw);
  if (raw.visibility === "visible") { if (raw.hiddenAt !== null || raw.suspended !== null) fail(); if (expected === null) { if (raw.timer !== null) fail(); } else { const current = token(raw.timer); if (current.kind !== expected || current.roundEpoch !== roundEpoch || current.stateEpoch !== stateEpoch) fail(); } }
  else { if (finite(raw.hiddenAt) < updatedAt || raw.timer !== null) fail(); if (expected === null) { if (raw.suspended !== null) fail(); } else { const suspended = object(raw.suspended); exactKeys(suspended, ["kind", "remainingMs"]); if (suspended.kind !== expected) fail(); finite(suspended.remainingMs); } }
  const count = raw.promptCount as 0 | 1 | 2;
  if ((m === "PET_PROMPT" || m === "PET_MISSED" || m === "PET_PROMPT_SUCCESS") && (raw.promptId !== count || (count !== 1 && count !== 2))) fail();
  if (m === "PET_NORMAL" || m === "PET_NORMAL_LEAVE_GRACE" || m === "PET_PROMPT_SUCCESS") { if (positive(raw.burstId) !== burstSequence || lastBurstAt === null || !isModality(raw.inputModality)) fail(); }
  if (m === "PET_NORMAL" && raw.inputModality !== "pointer" && raw.inputModality !== "keyboard" && raw.inputModality !== "touch") fail();
  if (m === "PET_NORMAL_LEAVE_GRACE" && raw.inputModality !== "pointer") fail();
  if (m === "HINT_ATTENTION") { if (raw.resumeMode !== "PLAYING" || !isModality(raw.inputModality) || (publicAwards.length > 0 && raw.inputModality === "keyboard")) fail(); }
  if (m === "TERMINAL_STORED_HINTS_PENDING") { if ((raw.resumeMode !== "WON" && raw.resumeMode !== "SURRENDERED") || raw.inputModality !== "pointer" && raw.inputModality !== "touch" || publicAwards.length === 0) fail(); }
  if (m === "STORED_HINTS") { if ((raw.resumeMode !== "PLAYING" && raw.resumeMode !== "WON" && raw.resumeMode !== "SURRENDERED") || !isModality(raw.inputModality) || publicAwards.length === 0 || (raw.cardPhase !== "open" && raw.cardPhase !== "closing") || (raw.cardPhase === "closing" && raw.inputModality !== "pointer")) fail(); }
  if (m === "HISTORY" && raw.resumeMode !== "PLAYING" && raw.resumeMode !== "WRONG" && raw.resumeMode !== "WON" && raw.resumeMode !== "SURRENDERED" && raw.resumeMode !== "HINT_REWARD") fail();
  if (m === "HISTORY" && raw.resumeMode === "HINT_REWARD") { const id = string(raw.challengeId); if (!challengeIds.includes(id)) fail(); const current = award(raw.award); const latest = publicAwards.at(-1); if (!latest || current.factId !== latest.factId || current.text !== latest.text) fail(); }
  if (m === "HINT_DIALOG" || m === "HINT_SUCCESS_HANDOFF" || m === "HINT_REWARD") { if (raw.resumeMode !== "PLAYING" && raw.resumeMode !== "WRONG") fail(); const id = string(raw.challengeId); if (!challengeIds.includes(id)) fail(); if (m !== "HINT_DIALOG") { const current = award(raw.award); const latest = publicAwards.at(-1); if (!latest || current.factId !== latest.factId || current.text !== latest.text) fail(); } }
  return raw as PresentationState;
}
function validateEvent(value: unknown): PresentationEvent {
  const raw = object(value); const type = raw.type; if (typeof type !== "string") fail();
  const round = ["ROUND_STARTED", "VALID_WRONG_GUESS", "ROUND_WON", "ROUND_SURRENDERED"];
  const simple = ["SHOW_HINT_ENTER", "SHOW_HINT_FOCUS", "SHOW_HINT_TOUCH_START", "SHOW_HINT_ACTIVATE", "SHOW_HINT_LEAVE", "STORED_HINTS_ESCAPE", "HISTORY_TOGGLE", "HISTORY_ACTIVITY", "HISTORY_CLOSE", "DOCUMENT_HIDDEN", "DOCUMENT_VISIBLE"];
  if (round.includes(type) || simple.includes(type)) { exactKeys(raw, ["type", "roundEpoch"]); positive(raw.roundEpoch); return raw as PresentationEvent; }
  if (type === "INPUT_VALUE_CHANGED") { exactKeys(raw, ["type", "roundEpoch", "inputRevision"]); positive(raw.roundEpoch); positive(raw.inputRevision); return raw as PresentationEvent; }
  if (type === "CAT_PET_START") { exactKeys(raw, ["type", "roundEpoch", "modality"]); positive(raw.roundEpoch); if (!isModality(raw.modality)) fail(); return raw as PresentationEvent; }
  if (type === "CAT_PET_END") { exactKeys(raw, ["type", "roundEpoch", "stateEpoch"]); positive(raw.roundEpoch); positive(raw.stateEpoch); return raw as PresentationEvent; }
  if (type === "HINT_DIALOG_OPEN" || type === "HINT_DIALOG_CLOSED") { exactKeys(raw, ["type", "roundEpoch", "challengeId"]); positive(raw.roundEpoch); string(raw.challengeId); return raw as PresentationEvent; }
  if (type === "HINT_AWARDED") { exactKeys(raw, ["type", "roundEpoch", "challengeId", "award"]); positive(raw.roundEpoch); string(raw.challengeId); award(raw.award); return raw as PresentationEvent; }
  if (type === "HINT_SUCCESS_COMPLETE_EARLY") { exactKeys(raw, ["type", "roundEpoch", "challengeId", "factId", "cause"]); positive(raw.roundEpoch); string(raw.challengeId); string(raw.factId); if (raw.cause !== "close" && raw.cause !== "escape") fail(); return raw as PresentationEvent; }
  if (Object.hasOwn(timerEventKinds, type)) { exactKeys(raw, ["type", "token"]); const current = token(raw.token); if (current.kind !== timerEventKinds[type]) fail(); return raw as PresentationEvent; }
  return fail();
}
function clock<K extends PresentationTimerKind | null>(state: Common, now: number, kind: K, dueAt?: number): Clock<K> {
  if (kind === null) return { visibility: "visible", hiddenAt: null, timer: null, suspended: null } as Clock<K>;
  return { visibility: "visible", hiddenAt: null, timer: { roundEpoch: state.roundEpoch, stateEpoch: state.stateEpoch, kind, dueAt: dueAt ?? now }, suspended: null } as Clock<K>;
}
function base(state: PresentationState, now: number, overrides: Record<string, unknown> = {}) {
  return { roundEpoch: state.roundEpoch, stateEpoch: state.stateEpoch + 1, updatedAt: now, inputRevision: state.inputRevision, idleStartedAt: state.idleStartedAt, promptAnchorAt: state.promptAnchorAt, promptCount: state.promptCount, burstSequence: state.burstSequence, lastBurstAt: state.lastBurstAt, publicAwards: state.publicAwards, challengeIds: state.challengeIds, ...overrides } as Common;
}
function playing(state: PresentationState, now: number, overrides: Record<string, unknown> = {}): PresentationState { const next = base(state, now, { idleStartedAt: now, ...overrides }); return { ...next, mode: "PLAYING", surface: "none", ...clock(next, now, "idle", now + 15001) } as PresentationState; }
function wrong(state: PresentationState, now: number): PresentationState { const next = base(state, now); return { ...next, mode: "WRONG", surface: "none", ...clock(next, now, null) } as PresentationState; }
function terminal(state: PresentationState, now: number, mode: "WON" | "SURRENDERED"): PresentationState { const next = base(state, now); return { ...next, mode, surface: "none", ...clock(next, now, null) } as PresentationState; }
function resumeStored(state: PresentationState, now: number, mode: StoredResumeMode): PresentationState { return mode === "PLAYING" ? playing(state, now) : terminal(state, now, mode); }
function history(state: PresentationState, now: number, resumeMode: HistoryBase): PresentationState { const next = base(state, now, { idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "HISTORY", surface: "history", resumeMode, ...clock(next, now, null) } as PresentationState; }
function historyReward(state: Extract<PresentationState, { mode: "HINT_REWARD" }>, now: number): PresentationState { if (!state.timer) fail(); const next = base(state, now, { idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "HISTORY", surface: "history", resumeMode: "HINT_REWARD", challengeId: state.challengeId, award: state.award, ...clock(next, now, "reward-expiry", state.timer.dueAt) } as PresentationState; }
function restoreHistoryReward(state: Extract<PresentationState, { mode: "HISTORY"; resumeMode: "HINT_REWARD" }>, now: number): PresentationState { if (!state.timer) fail(); if (now >= state.timer.dueAt) return playing(state, now); const next = base(state, now); return { ...next, mode: "HINT_REWARD", surface: "hint-reward", resumeMode: "PLAYING", challengeId: state.challengeId, award: state.award, ...clock(next, now, "reward-expiry", state.timer.dueAt) } as PresentationState; }
function resumeHistory(state: PresentationState, now: number, mode: HistoryBase): PresentationState { return mode === "PLAYING" || mode === "WRONG" ? toBase(state, now, mode) : terminal(state, now, mode); }
function activeBase(state: PresentationState): ActiveBase { return state.mode === "WRONG" || (state.mode === "HISTORY" && state.resumeMode === "WRONG") ? "WRONG" : "PLAYING"; }
function toBase(state: PresentationState, now: number, mode: ActiveBase): PresentationState { return mode === "WRONG" ? wrong(state, now) : playing(state, now); }
// A deadline can fire after a round or state transition. Its full token keeps that stale
// callback from advancing the newer presentation state.
function timerMatches(state: PresentationState, event: PresentationEvent, now: number): boolean { if (!("token" in event) || !state.timer || !sameToken(state.timer, event.token)) return false; return now >= state.timer.dueAt; }
function startState(roundEpoch: number, now: number): PresentationState { const common: Common = { roundEpoch, stateEpoch: 1, updatedAt: now, inputRevision: 0, idleStartedAt: now, promptAnchorAt: now, promptCount: 0, burstSequence: 0, lastBurstAt: null, publicAwards: [], challengeIds: [] }; return { ...common, mode: "PLAYING", surface: "none", ...clock(common, now, "idle", now + 15001) } as PresentationState; }
function hidden(state: PresentationState, now: number): PresentationState { const next = base(state, now); const remaining = state.timer ? Math.max(0, state.timer.dueAt - now) : null; return { ...next, ...Object.fromEntries(Object.entries(state).filter(([key]) => !["stateEpoch", "updatedAt", "visibility", "hiddenAt", "timer", "suspended"].includes(key))), visibility: "hidden", hiddenAt: now, timer: null, suspended: state.timer ? { kind: state.timer.kind, remainingMs: remaining! } : null } as PresentationState; }
// Hidden time pauses the presentation clock: anchors move forward and a suspended timer resumes
// only with its remaining duration, rather than expiring while the document is unavailable.
function visible(state: PresentationState, now: number): PresentationState { const duration = now - (state.hiddenAt as number); const next = base(state, now, { idleStartedAt: state.idleStartedAt + duration, promptAnchorAt: state.promptAnchorAt + duration, lastBurstAt: state.lastBurstAt === null ? null : state.lastBurstAt + duration }); const suspended = state.suspended; const rest = Object.fromEntries(Object.entries(state).filter(([key]) => !["stateEpoch", "updatedAt", "idleStartedAt", "promptAnchorAt", "lastBurstAt", "visibility", "hiddenAt", "timer", "suspended"].includes(key))); return { ...next, ...rest, ...clock(next, now, suspended?.kind ?? null, suspended ? now + suspended.remainingMs : undefined) } as PresentationState; }
function remainHidden(previous: PresentationState, next: PresentationState, now: number): PresentationState {
  const suspended = next.timer ? { kind: next.timer.kind, remainingMs: Math.max(0, next.timer.dueAt - now) } : null;
  return { ...next, visibility: "hidden", hiddenAt: now, timer: null, suspended } as PresentationState;
}

export function reducePresentation(state: PresentationState | null, event: PresentationEvent, now: number): PresentationState {
  finite(now); const e = validateEvent(event);
  if (state === null) { if (e.type !== "ROUND_STARTED") fail(); return startState(e.roundEpoch, now); }
  const s = validateState(state); if (now < s.updatedAt) fail();
  if (e.type === "ROUND_STARTED") {
    if (e.roundEpoch <= s.roundEpoch) return s;
    const next = startState(e.roundEpoch, now);
    return s.visibility === "hidden" ? remainHidden(s, next, now) : next;
  }
  if ("roundEpoch" in e && e.roundEpoch !== s.roundEpoch) return s;
  if (s.visibility === "hidden") {
    if (e.type === "DOCUMENT_VISIBLE") return visible(s, now);
    if (e.type === "DOCUMENT_HIDDEN") return s;
    if (e.type === "ROUND_WON" || e.type === "ROUND_SURRENDERED") {
      if (s.mode === "WON" || s.mode === "SURRENDERED" || (s.mode === "HISTORY" && (s.resumeMode === "WON" || s.resumeMode === "SURRENDERED"))) return s;
      const next = s.mode === "HISTORY" ? history(s, now, e.type === "ROUND_WON" ? "WON" : "SURRENDERED") : terminal(s, now, e.type === "ROUND_WON" ? "WON" : "SURRENDERED");
      return remainHidden(s, next, now);
    }
    return s;
  }
  if (e.type === "DOCUMENT_HIDDEN") return hidden(s, now);
  if (e.type === "DOCUMENT_VISIBLE") return s;
  if (e.type === "ROUND_WON" || e.type === "ROUND_SURRENDERED") {
    if (s.mode === "WON" || s.mode === "SURRENDERED" || (s.mode === "HISTORY" && (s.resumeMode === "WON" || s.resumeMode === "SURRENDERED"))) return s;
    return s.mode === "HISTORY" ? history(s, now, e.type === "ROUND_WON" ? "WON" : "SURRENDERED") : terminal(s, now, e.type === "ROUND_WON" ? "WON" : "SURRENDERED");
  }
  if (s.mode === "WON" || s.mode === "SURRENDERED" || (s.mode === "HISTORY" && (s.resumeMode === "WON" || s.resumeMode === "SURRENDERED"))) {
    if (e.type === "HISTORY_TOGGLE" || e.type === "HISTORY_CLOSE") {
      if (s.mode === "HISTORY") {
        const terminalMode = s.resumeMode;
        if (terminalMode !== "WON" && terminalMode !== "SURRENDERED") return s;
        return terminal(s, now, terminalMode);
      }
      return history(s, now, s.mode);
    }
    if ((e.type === "SHOW_HINT_ENTER" || e.type === "SHOW_HINT_FOCUS" || e.type === "SHOW_HINT_TOUCH_START" || e.type === "SHOW_HINT_ACTIVATE") && s.publicAwards.length > 0) {
      const modality: PresentationModality = e.type === "SHOW_HINT_FOCUS" ? "keyboard" : e.type === "SHOW_HINT_TOUCH_START" ? "touch" : "pointer";
      const resumeMode = s.mode === "HISTORY" ? s.resumeMode : s.mode;
      if (resumeMode !== "WON" && resumeMode !== "SURRENDERED") return s;
      const next = base(s, now, { idleStartedAt: now, promptAnchorAt: now });
      if (modality === "keyboard" || e.type === "SHOW_HINT_ACTIVATE") return { ...next, mode: "STORED_HINTS", surface: "stored-hints", resumeMode, inputModality: modality, cardPhase: "open", ...clock(next, now, null) } as PresentationState;
      return { ...next, mode: "TERMINAL_STORED_HINTS_PENDING", surface: "none", resumeMode, inputModality: modality, ...clock(next, now, "stored-open", now + (modality === "pointer" ? 150 : 500)) } as PresentationState;
    }
    return s;
  }
  if (e.type === "VALID_WRONG_GUESS") return s.mode === "HINT_DIALOG" || s.mode === "HINT_SUCCESS_HANDOFF" ? s : s.mode === "HISTORY" ? history(s, now, "WRONG") : wrong(s, now);
  if (e.type === "INPUT_VALUE_CHANGED") { if (e.inputRevision <= s.inputRevision || s.mode === "HINT_DIALOG" || s.mode === "HINT_SUCCESS_HANDOFF") return s; if (s.mode === "HISTORY") return history({ ...s, inputRevision: e.inputRevision } as PresentationState, now, "PLAYING"); return playing({ ...s, inputRevision: e.inputRevision } as PresentationState, now); }
  if (e.type === "HISTORY_TOGGLE") { if (s.mode === "HISTORY") return s.resumeMode === "HINT_REWARD" ? restoreHistoryReward(s, now) : resumeHistory(s, now, s.resumeMode); return s.mode === "HINT_REWARD" ? historyReward(s, now) : history(s, now, activeBase(s)); }
  if (e.type === "HISTORY_CLOSE") return s.mode === "HISTORY" ? s.resumeMode === "HINT_REWARD" ? restoreHistoryReward(s, now) : resumeHistory(s, now, s.resumeMode) : s;
  if (e.type === "HISTORY_ACTIVITY") return s.mode === "HISTORY" && (s.resumeMode === "PLAYING" || s.resumeMode === "WRONG") ? history(s, now, s.resumeMode) : s;
  if (e.type === "HINT_DIALOG_OPEN") { if (s.mode === "HINT_DIALOG" || s.mode === "HINT_SUCCESS_HANDOFF") { if (s.challengeId === e.challengeId) return s; } if (s.challengeIds.includes(e.challengeId)) return s; const resumeMode: ActiveBase = s.mode === "HINT_DIALOG" || s.mode === "HINT_SUCCESS_HANDOFF" || s.mode === "HINT_REWARD" ? s.resumeMode : activeBase(s); const next = base(s, now, { idleStartedAt: now, promptAnchorAt: now, challengeIds: [...s.challengeIds, e.challengeId] }); return { ...next, mode: "HINT_DIALOG", surface: "hint-dialog", resumeMode, challengeId: e.challengeId, ...clock(next, now, null) } as PresentationState; }
  if (e.type === "HINT_DIALOG_CLOSED") return s.mode === "HINT_DIALOG" && s.challengeId === e.challengeId ? toBase(s, now, s.resumeMode) : s;
  if (e.type === "HINT_AWARDED") { if ((s.mode !== "HINT_DIALOG" && s.mode !== "HINT_SUCCESS_HANDOFF") || s.challengeId !== e.challengeId) return s; const existing = s.publicAwards.find((item) => item.factId === e.award.factId); if (existing && existing.text === e.award.text) return s; if (existing) fail(); const awards = [...s.publicAwards, e.award] as readonly PublicAward[]; const next = base(s, now, { publicAwards: awards }); return { ...next, mode: "HINT_SUCCESS_HANDOFF", surface: "hint-dialog", resumeMode: s.resumeMode, challengeId: s.challengeId, award: e.award, ...clock(next, now, "hint-success", now + 2500) } as PresentationState; }
  if (e.type === "HINT_SUCCESS_COMPLETE_EARLY") { if (s.mode !== "HINT_SUCCESS_HANDOFF" || s.challengeId !== e.challengeId || s.award.factId !== e.factId) return s; const next = base(s, now); return { ...next, mode: "HINT_REWARD", surface: "hint-reward", resumeMode: s.resumeMode, challengeId: s.challengeId, award: s.award, ...clock(next, now, "reward-expiry", now + 5000) } as PresentationState; }
  if (e.type === "CAT_PET_START") { if (s.mode === "PET_PROMPT") { if (now >= (s.timer?.dueAt ?? now)) return s; const next = base(s, now, { burstSequence: s.burstSequence + 1, lastBurstAt: now }); return { ...next, mode: "PET_PROMPT_SUCCESS", surface: "none", promptId: s.promptId, burstId: next.burstSequence, inputModality: e.modality, ...clock(next, now, "pet-prompt-success-settle", now + 4000) } as PresentationState; } if (s.mode !== "PLAYING" && s.mode !== "LONG_IDLE") return s; if (s.lastBurstAt !== null && now - s.lastBurstAt < 900) return s; const next = base(s, now, { burstSequence: s.burstSequence + 1, lastBurstAt: now, idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "PET_NORMAL", surface: "none", burstId: next.burstSequence, inputModality: e.modality, ...clock(next, now, "pet-normal-settle", now + 1200) } as PresentationState; }
  if (e.type === "CAT_PET_END") return s;
  if (e.type === "SHOW_HINT_ENTER" || e.type === "SHOW_HINT_FOCUS" || e.type === "SHOW_HINT_TOUCH_START") { if (s.mode === "PET_PROMPT" && now >= (s.timer?.dueAt ?? now)) return s; if (s.mode !== "PLAYING" && s.mode !== "LONG_IDLE" && s.mode !== "PET_PROMPT" && s.mode !== "HINT_ATTENTION" && s.mode !== "STORED_HINTS" && s.mode !== "HINT_REWARD") return s; const modality: PresentationModality = e.type === "SHOW_HINT_FOCUS" ? "keyboard" : e.type === "SHOW_HINT_TOUCH_START" ? "touch" : "pointer"; if (s.mode === "STORED_HINTS" && s.cardPhase === "open") return s; if (s.mode === "STORED_HINTS" && s.cardPhase === "closing") { const next = base(s, now, { idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "STORED_HINTS", surface: "stored-hints", resumeMode: s.resumeMode, inputModality: modality, cardPhase: "open", ...clock(next, now, null) } as PresentationState; } const facts = s.publicAwards; if (facts.length > 0 && modality === "keyboard") { const next = base(s, now, { idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "STORED_HINTS", surface: "stored-hints", resumeMode: "PLAYING", inputModality: modality, cardPhase: "open", ...clock(next, now, null) } as PresentationState; } const next = base(s, now, { idleStartedAt: now, promptAnchorAt: now }); return { ...next, mode: "HINT_ATTENTION", surface: "none", resumeMode: "PLAYING", inputModality: modality, ...clock(next, now, facts.length === 0 ? null : "stored-open", facts.length === 0 ? undefined : now + (modality === "pointer" ? 150 : 500)) } as PresentationState; }
  if (e.type === "SHOW_HINT_LEAVE" || e.type === "STORED_HINTS_ESCAPE") { if (s.mode === "HINT_ATTENTION") return playing(s, now); if (s.mode === "TERMINAL_STORED_HINTS_PENDING") return terminal(s, now, s.resumeMode); if (s.mode !== "STORED_HINTS") return s; if (e.type === "STORED_HINTS_ESCAPE" || s.inputModality !== "pointer") return resumeStored(s, now, s.resumeMode); if (s.cardPhase === "closing") return s; const next = base(s, now); return { ...next, mode: "STORED_HINTS", surface: "stored-hints", resumeMode: s.resumeMode, inputModality: "pointer", cardPhase: "closing", ...clock(next, now, "stored-close", now + 201) } as PresentationState; }
  if ("token" in e) {
    if (!timerMatches(s, e, now)) return s;
    const kind = e.token.kind;
    if (kind === "idle") {
      const next = base(s, now);
      if (s.promptCount === 2) return { ...next, mode: "LONG_IDLE", surface: "none", ...clock(next, now, null) } as PresentationState;
      const due = s.promptCount === 0 ? s.promptAnchorAt + 30000 : s.promptAnchorAt + 60000;
      return { ...next, mode: "LONG_IDLE", surface: "none", ...clock(next, now, "prompt-due", Math.max(now, due)) } as PresentationState;
    }
    if (kind === "prompt-due") {
      const next = base(s, now, { promptCount: (s.promptCount + 1) as 1 | 2, promptAnchorAt: now });
      return { ...next, mode: "PET_PROMPT", surface: "none", promptId: next.promptCount as 1 | 2, ...clock(next, now, "prompt-expiry", now + 5000) } as PresentationState;
    }
    if (kind === "prompt-expiry") {
      if (s.mode !== "PET_PROMPT") return s;
      const next = base(s, now);
      return { ...next, mode: "PET_MISSED", surface: "none", promptId: s.promptId, ...clock(next, now, "prompt-missed-settle", now + 5000) } as PresentationState;
    }
    if (kind === "prompt-missed-settle" || kind === "pet-normal-settle" || kind === "pet-normal-leave-grace" || kind === "pet-prompt-success-settle") return playing(s, now);
    if (kind === "stored-open") {
      if (s.mode !== "HINT_ATTENTION" && s.mode !== "TERMINAL_STORED_HINTS_PENDING") return s;
      const next = base(s, now);
      return { ...next, mode: "STORED_HINTS", surface: "stored-hints", resumeMode: s.resumeMode, inputModality: s.inputModality, cardPhase: "open", ...clock(next, now, null) } as PresentationState;
    }
    if (kind === "stored-close") return s.mode === "STORED_HINTS" ? resumeStored(s, now, s.resumeMode) : s;
    if (kind === "hint-success") {
      if (s.mode !== "HINT_SUCCESS_HANDOFF") return s;
      const next = base(s, now);
      return { ...next, mode: "HINT_REWARD", surface: "hint-reward", resumeMode: s.resumeMode, challengeId: s.challengeId, award: s.award, ...clock(next, now, "reward-expiry", now + 5000) } as PresentationState;
    }
    if (kind === "reward-expiry") {
      if (s.mode === "HISTORY" && s.resumeMode === "HINT_REWARD") return history(s, now, "PLAYING");
      if (s.mode !== "HINT_REWARD") return s;
      return s.resumeMode === "WRONG" ? wrong(s, now) : playing(s, now);
    }
  }
  return s;
}
