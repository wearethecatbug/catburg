import type {TaskDefinition} from '../catalog/taskCatalog';
import {TASK_TOPICS} from '../catalog/taskCatalogueRows';

export const CUSTOM_TASK_TOPICS = TASK_TOPICS;
export type CustomTaskTopic = (typeof CUSTOM_TASK_TOPICS)[number];
export type CustomTaskRecord = TaskDefinition & { readonly topic?: CustomTaskTopic };
type CustomTaskFailureDetails = { readonly recoveryRaw?: string };
export type CustomTaskFailure = CustomTaskFailureDetails & (
    | { readonly ok: false; readonly kind: 'cancelled'; readonly message: string }
    | { readonly ok: false; readonly kind: 'duplicate-id'; readonly source: 'document' | 'incoming'; readonly message: string; readonly recoveryRaw?: string }
    | { readonly ok: false; readonly kind: 'invalid' | 'storage'; readonly message: string; readonly recoveryRaw?: string }
);
export type CustomTaskResult =
    | { readonly ok: true; readonly tasks: readonly CustomTaskRecord[] }
    | CustomTaskFailure;
