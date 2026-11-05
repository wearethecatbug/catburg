import type {TaskDefinition} from '../catalog/taskCatalog';
import {TASK_TOPICS} from '../catalog/taskCatalogueRows';

export const CUSTOM_TASK_TOPICS = TASK_TOPICS;
export type CustomTaskTopic = (typeof CUSTOM_TASK_TOPICS)[number];
export type CustomTaskRecord = TaskDefinition & { readonly topic?: CustomTaskTopic };
export type CustomTaskResult =
    | { readonly ok: true; readonly tasks: readonly CustomTaskRecord[] }
    | { readonly ok: false; readonly message: string };
