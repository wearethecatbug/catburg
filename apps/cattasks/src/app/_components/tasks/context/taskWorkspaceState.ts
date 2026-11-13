import type {IsolatedTaskResult} from '../lib/IsolatedTaskRunner';

export type ContentTab = 'description' | 'solution' | 'hint' | 'mySolution';
export type TaskRunRecord = { readonly mode: 'run' | 'test'; readonly result: IsolatedTaskResult };
export type TaskWorkspace = {
    readonly draft: string;
    readonly draftGeneration: number;
    readonly runGeneration: number;
    readonly completedTestGeneration?: number;
    readonly result?: TaskRunRecord;
};
export type TaskWorkspaceState = {
    readonly selectedId: string | null;
    readonly selectionGeneration: number;
    readonly activeContentTab: ContentTab;
    readonly workspaces: ReadonlyMap<string, TaskWorkspace>;
};
export type TaskRunToken = {
    readonly taskId: string;
    readonly selectionGeneration: number;
    readonly draftGeneration: number;
    readonly runGeneration: number;
    readonly mode: TaskRunRecord['mode'];
};

const emptyWorkspace = (starterCode: string): TaskWorkspace => ({draft: starterCode, draftGeneration: 0, runGeneration: 0});

function workspaceFor(state: TaskWorkspaceState, id: string, starterCode: string): TaskWorkspace {
    return state.workspaces.get(id) ?? emptyWorkspace(starterCode);
}

function withWorkspace(state: TaskWorkspaceState, id: string, workspace: TaskWorkspace): TaskWorkspaceState {
    const workspaces = new Map(state.workspaces);
    workspaces.set(id, workspace);
    return {...state, workspaces};
}

export function createTaskWorkspaceState(): TaskWorkspaceState {
    return {selectedId: null, selectionGeneration: 0, activeContentTab: 'description', workspaces: new Map()};
}

export function selectTask(state: TaskWorkspaceState, id: string, _starterCode: string): TaskWorkspaceState {
    if (state.selectedId === id) return state;
    return {...state, selectedId: id, selectionGeneration: state.selectionGeneration + 1, activeContentTab: 'description'};
}

export function clearTaskSelection(state: TaskWorkspaceState): TaskWorkspaceState {
    if (state.selectedId === null && state.activeContentTab === 'description') return state;
    return {...state, selectedId: null, selectionGeneration: state.selectionGeneration + 1, activeContentTab: 'description'};
}

export function setTaskDraft(state: TaskWorkspaceState, id: string, draft: string, starterCode: string): TaskWorkspaceState {
    const workspace = workspaceFor(state, id, starterCode);
    if (workspace.draft === draft) return state;
    return withWorkspace(state, id, {...workspace, draft, draftGeneration: workspace.draftGeneration + 1, completedTestGeneration: undefined, result: undefined});
}

export function beginTaskRun(
    state: TaskWorkspaceState,
    id: string,
    starterCode: string,
    mode: TaskRunRecord['mode'],
): {state: TaskWorkspaceState; token: TaskRunToken} | null {
    if (state.selectedId !== id) return null;
    const workspace = workspaceFor(state, id, starterCode);
    const runGeneration = workspace.runGeneration + 1;
    const nextState = withWorkspace(state, id, {...workspace, runGeneration});
    return {
        state: nextState,
        token: {taskId: id, selectionGeneration: state.selectionGeneration, draftGeneration: workspace.draftGeneration, runGeneration, mode},
    };
}

export function completeTaskRun(state: TaskWorkspaceState, token: TaskRunToken, result: IsolatedTaskResult): TaskWorkspaceState {
    if (state.selectedId !== token.taskId || state.selectionGeneration !== token.selectionGeneration) return state;
    const workspace = state.workspaces.get(token.taskId);
    if (!workspace || workspace.draftGeneration !== token.draftGeneration || workspace.runGeneration !== token.runGeneration) return state;
    const completedTestGeneration = token.mode === 'test' && result.status === 'completed' &&
        typeof result.passedCount === 'number' && typeof result.totalTests === 'number' &&
        Number.isInteger(result.passedCount) && Number.isInteger(result.totalTests) &&
        result.totalTests > 0 && result.passedCount === result.totalTests
        ? workspace.draftGeneration
        : token.mode === 'test' && result.status !== 'cancelled'
            ? undefined
            : workspace.completedTestGeneration;
    return withWorkspace(state, token.taskId, {...workspace, completedTestGeneration, result: {mode: token.mode, result}});
}
