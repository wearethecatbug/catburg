export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type TaskTestCase = {
    readonly args: JsonValue[];
    readonly expected: JsonValue;
};
export type TaskDifficulty = 'Easy' | 'Medium' | 'Hard';
export type TaskSolution = { readonly id: string; readonly label: string; readonly code: string; readonly timeComplexity: string; readonly spaceComplexity: string; readonly rationale: string };

export type TaskDefinition = {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly entryPoint: string;
    readonly starterCode: string;
    readonly solution: string;
    readonly tests: readonly TaskTestCase[];
    readonly slug?: string;
    readonly hints?: readonly string[];
    readonly solutions?: readonly TaskSolution[];
    readonly difficulty?: TaskDifficulty;
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
const reservedEntryPoints = new Set([
    "arguments", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
    "do", "else", "enum", "eval", "export", "extends", "false", "finally", "for", "function", "if", "implements",
    "import", "in", "instanceof", "interface", "let", "new", "null", "package", "private", "protected", "public",
    "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

export function isTaskEntryPoint(value: string): boolean {
    return identifierPattern.test(value) && !reservedEntryPoints.has(value);
}

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

function readComplexity(value: unknown, path: string): string {
    const text = readNonBlankString(value, path);
    const [base, qualifier] = text.split(';', 2);
    const expression = /^O\((.*)\)$/.exec(base.trim())?.[1];
    if (!expression || !isComplexityExpression(expression)) fail(path, 'must use approved O(...) notation');
    if (text.includes(';') && (!qualifier || qualifier.trim() === '')) fail(path, 'qualifier must be non-empty');
    return text;
}
function isComplexityExpression(expression: string): boolean {
    const tokens = expression.match(/\s+|amount|capacity|coins|depth|output|rows|cols|Cn|log(?=\s|\()|[nmkuVEdLh]|\d+|[+*()]/g);
    if (!tokens || tokens.join('') !== expression) return false;
    let depth = 0;
    let expectValue = true;
    let previous: string | null = null;
    for (const raw of tokens) {
        if (/^\s+$/.test(raw)) continue;
        if (raw === '(') { if (!expectValue) return false; depth++; previous = raw; continue; }
        if (raw === ')') { if (expectValue || depth-- === 0) return false; expectValue = false; previous = raw; continue; }
        if (raw === '+' || raw === '*') { if (expectValue) return false; expectValue = true; previous = raw; continue; }
        if (raw === 'log') { if (previous === 'log') return false; expectValue = true; previous = raw; continue; }
        if (!expectValue) return false;
        expectValue = false;
        previous = raw;
    }
    return !expectValue && depth === 0;
}
function readHints(value: Record<string, unknown>, path: string): readonly string[] {
    if ('hints' in value) {
        if (!Array.isArray(value.hints)) fail(`${path}.hints`, 'must be an array when present');
        return value.hints.map((hint, index) => readNonBlankString(hint, `${path}.hints[${index}]`));
    }
    if ('hint' in value) return [readNonBlankString(value.hint, `${path}.hint`)];
    return [];
}
function readSolutions(value: Record<string, unknown>, path: string): readonly TaskSolution[] {
    if (!('solutions' in value)) return [];
    if (!Array.isArray(value.solutions) || value.solutions.length === 0) fail(`${path}.solutions`, 'must be a non-empty array when present');
    const ids = new Set<string>();
    return value.solutions.map((solution, index) => {
        const solutionPath = `${path}.solutions[${index}]`;
        if (!isRecord(solution)) fail(solutionPath, 'must be an object');
        const id = readNonBlankString(solution.id, `${solutionPath}.id`);
        if (ids.has(id)) fail(`${solutionPath}.id`, `duplicate solution id '${id}'`);
        ids.add(id);
        return {id, label: readNonBlankString(solution.label, `${solutionPath}.label`), code: readNonBlankString(solution.code, `${solutionPath}.code`), timeComplexity: readComplexity(solution.timeComplexity, `${solutionPath}.timeComplexity`), spaceComplexity: readComplexity(solution.spaceComplexity, `${solutionPath}.spaceComplexity`), rationale: readNonBlankString(solution.rationale, `${solutionPath}.rationale`)};
    });
}

export function parseTaskDefinition(value: unknown, path = "task"): TaskDefinition {
    if (!isRecord(value)) fail(path, "must be an object");
    const id = readNonBlankString(value.id, `${path}.id`);
    const entryPoint = readNonBlankString(value.entryPoint, `${path}.entryPoint`);
    if (!isTaskEntryPoint(entryPoint)) fail(`${path}.entryPoint`, "must be a JavaScript entry point");
    if (!Array.isArray(value.tests) || value.tests.length === 0) fail(`${path}.tests`, "must be a non-empty array");
    const solution = readNonBlankString(value.solution, `${path}.solution`);
    const hints = readHints(value, path);
    const solutions = readSolutions(value, path);
    return {
        id,
        title: readNonBlankString(value.title, `${path}.title`),
        description: readNonBlankString(value.description, `${path}.description`),
        entryPoint,
        starterCode: readNonBlankString(value.starterCode, `${path}.starterCode`),
        solution: solutions[0]?.code ?? solution,
        tests: value.tests.map((test, index) => readTest(test, `${path}.tests[${index}]`)),
        ...('slug' in value ? {slug: readNonBlankString(value.slug, `${path}.slug`)} : {}),
        ...('hints' in value || 'hint' in value ? {hints} : {}),
        ...('solutions' in value ? {solutions} : {}),
        ...('difficulty' in value ? (() => { if (value.difficulty !== 'Easy' && value.difficulty !== 'Medium' && value.difficulty !== 'Hard') fail(`${path}.difficulty`, 'must be Easy, Medium, or Hard'); return {difficulty: value.difficulty as TaskDifficulty}; })() : {}),
    };
}

export function parseTaskCatalog(value: unknown): TaskCatalog {
    if (!isRecord(value)) fail("catalog", "must be an object");
    if (value.version !== 1) fail("catalog.version", "must equal 1");
    if (!Array.isArray(value.tasks) || value.tasks.length === 0) fail("catalog.tasks", "must be a non-empty array");
    const ids = new Set<string>(); const slugs = new Set<string>();
    const tasks = value.tasks.map((task, index) => {
        const parsed = parseTaskDefinition(task, `catalog.tasks[${index}]`);
        if (ids.has(parsed.id)) fail(`catalog.tasks[${index}].id`, `duplicate id '${parsed.id}'`);
        const expectedId = `ct-js-${String(index + 1).padStart(2, '0')}`;
        if (parsed.id.startsWith('ct-js-') && (parsed.id !== expectedId || 'ordinal' in (task as Record<string, unknown>) || !parsed.slug || (parsed.hints?.length ?? 0) < 2 || (parsed.solutions?.length ?? 0) === 0 || !parsed.difficulty)) fail(`catalog.tasks[${index}]`, 'built-in tasks require canonical sequence, no ordinal, slug, two hints, solutions, and difficulty');
        if (parsed.slug && slugs.has(parsed.slug)) fail(`catalog.tasks[${index}].slug`, `duplicate slug '${parsed.slug}'`);
        ids.add(parsed.id);
        if (parsed.slug) slugs.add(parsed.slug);
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
