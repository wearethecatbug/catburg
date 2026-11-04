export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type TaskTestCase = {
    readonly args: JsonValue[];
    readonly expected: JsonValue;
};

export type TaskDefinition = {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly entryPoint: string;
    readonly starterCode: string;
    readonly solution: string;
    readonly tests: readonly TaskTestCase[];
};

export type TaskCatalog = {
    readonly version: 1;
    readonly tasks: readonly TaskDefinition[];
};

export type CatalogTask = TaskDefinition & { readonly ordinal: number };

export class CatalogValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CatalogValidationError";
    }
}

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function fail(path: string, message: string): never {
    throw new CatalogValidationError(`${path}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonBlankString(value: unknown, path: string): string {
    if (typeof value !== "string" || value.trim() === "") fail(path, "must be a non-empty string");
    return value;
}

function isJsonValue(value: unknown): value is JsonValue {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    return isRecord(value) && Object.values(value).every(isJsonValue);
}

function readTest(value: unknown, path: string): TaskTestCase {
    if (!isRecord(value)) fail(path, "must be an object");
    if (!Array.isArray(value.args)) fail(`${path}.args`, "must be an array (including [] for zero arguments)");
    if (!value.args.every(isJsonValue)) fail(`${path}.args`, "must contain JSON values only");
    if (!("expected" in value) || !isJsonValue(value.expected)) fail(`${path}.expected`, "must be a JSON value");
    return {args: value.args, expected: value.expected};
}

function readTask(value: unknown, path: string): TaskDefinition {
    if (!isRecord(value)) fail(path, "must be an object");
    const id = readNonBlankString(value.id, `${path}.id`);
    const entryPoint = readNonBlankString(value.entryPoint, `${path}.entryPoint`);
    if (!identifierPattern.test(entryPoint)) fail(`${path}.entryPoint`, "must be a JavaScript identifier");
    if (!Array.isArray(value.tests) || value.tests.length === 0) fail(`${path}.tests`, "must be a non-empty array");
    return {
        id,
        title: readNonBlankString(value.title, `${path}.title`),
        description: readNonBlankString(value.description, `${path}.description`),
        entryPoint,
        starterCode: readNonBlankString(value.starterCode, `${path}.starterCode`),
        solution: readNonBlankString(value.solution, `${path}.solution`),
        tests: value.tests.map((test, index) => readTest(test, `${path}.tests[${index}]`)),
    };
}

export function parseTaskCatalog(value: unknown): TaskCatalog {
    if (!isRecord(value)) fail("catalog", "must be an object");
    if (value.version !== 1) fail("catalog.version", "must equal 1");
    if (!Array.isArray(value.tasks) || value.tasks.length === 0) fail("catalog.tasks", "must be a non-empty array");
    const ids = new Set<string>();
    const tasks = value.tasks.map((task, index) => {
        const parsed = readTask(task, `catalog.tasks[${index}]`);
        if (ids.has(parsed.id)) fail(`catalog.tasks[${index}].id`, `duplicate id '${parsed.id}'`);
        ids.add(parsed.id);
        return parsed;
    });
    return {version: 1, tasks};
}

function toCatalogTask(task: TaskDefinition, ordinal: number): CatalogTask {
    return {...task, ordinal};
}

export async function loadBuiltinTaskCatalog(signal?: AbortSignal): Promise<readonly CatalogTask[]> {
    const response = await fetch("/task-catalog.v1.json", {signal});
    if (!response.ok) throw new CatalogValidationError(`catalog request failed with HTTP ${response.status}`);
    let raw: unknown;
    try {
        raw = await response.json();
    } catch {
        throw new CatalogValidationError("catalog response is not valid JSON");
    }
    return parseTaskCatalog(raw).tasks.map((task, index) => toCatalogTask(task, index + 1));
}
