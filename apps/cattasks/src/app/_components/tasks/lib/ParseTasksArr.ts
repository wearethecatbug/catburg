export type ParsedTest = {
    parameters: unknown[] | string; // сначала пытаемся распарсить в массив, иначе сырой текст
    expected: unknown | string;     // сначала пытаемся распарсить число/массив, иначе сырой текст
};

export type ParsedTask = {
    id: string;          // уникальный slug
    no: number;          // порядковый номер
    title: string;       // сгенерированный заголовок
    description: string; // исходное описание (до решения)
    solution?: string;    // HTML между маркерами
    tests?: ParsedTest[];
};

// парсер: делает массив задач с title и test
export function parseTasksArr(raw: string): ParsedTask[] {
    raw = normalizeRawInput(raw);
    const startRegExp = /<!--\s*(?:<!DOCTYPE html>|<html>)\s*-->/g;
    const endRegExp = /<!--\s*<\/html>\s*-->/g;

    const slugCountsMap = new Map<string, number>();
    const parsedTasks: ParsedTask[] = [];

    let lastEndIndex = 0;
    let startMatch: RegExpExecArray | null;

    while ((startMatch = startRegExp.exec(raw))) {
        const solutionStartIndex = startMatch.index + startMatch[0].length;
        endRegExp.lastIndex = solutionStartIndex;

        const endMatch = endRegExp.exec(raw);
        if (!endMatch) break;

        const descriptionRaw = raw.slice(lastEndIndex, startMatch.index).trim();
        const solutionRaw = raw.slice(solutionStartIndex, endMatch.index).trim();

        if (descriptionRaw) {
            const description = unwrapHtmlComments(descriptionRaw);
            const solution = prepareEditorCodeFromSolution(unwrapHtmlComments(solutionRaw));
            const title = makeTitle(description);
            const id = makeUniqueSlug(title, slugCountsMap);
            const tests = extractTestsFromSolution(solution);

            parsedTasks.push({
                id,
                title,
                description,
                solution,
                tests,
                no: parsedTasks.length + 1,
            });
        }
        lastEndIndex = endMatch.index + endMatch[0].length;
    }
    return parsedTasks;
}

function normalizeRawInput(rawInput: string): string {
    return rawInput.replace(/^\uFEFF/, '');
}

// function makeTitle(description: string): string {
//     const cleaned = description.replace(/<!--|-->/g, '').trim();
//     const firstLine = cleaned.split(/\r?\n/).find(Boolean) ?? 'Task';
//     return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
// }

function makeTitle(description: string): string {
    const cleanedDescription = description.replace(/<!--|-->/g, '').trim();

    const dotIndex = cleanedDescription.indexOf('.');
    const baseTitle = dotIndex >= 0
        ? cleanedDescription.slice(0, dotIndex)
        : (cleanedDescription.split(/\r?\n/).find(Boolean) ?? 'Task');

    const title = baseTitle.trim();
    return title.length ? title : 'Task';
}

function makeUniqueSlug(title: string, usedSlugCounts: Map<string, number>): string {
    let normalizedSlug =
        title
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '') || 'task';

    const nextCount = (usedSlugCounts.get(normalizedSlug) ?? 0) + 1;
    usedSlugCounts.set(normalizedSlug, nextCount);

    return nextCount === 1 ? normalizedSlug : `${normalizedSlug}-${nextCount}`;
}

// извлекает alert(fn(args)); // expected  →  { parameters, expected }
function extractTestsFromSolution(solution: string): ParsedTest[] {
    const javascriptBody = solution.replace(/<!--\s*|\s*-->/g, "");
    const alertPattern =
        /alert\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*(?:\/\/\s*([^\n\r]*))?(?=$|\r?\n)/g;

    const tests: ParsedTest[] = [];
    let match: RegExpExecArray | null;

    while ((match = alertPattern.exec(javascriptBody))) {
        const callExpression = (match[1] ?? "").trim();   // race(80, 91, 37)
        const expectedRaw = (match[2] ?? "").trim();      // [3, 21, 49]  |  42  |  ""
        if (!callExpression) continue;

        const callMatch = /^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/.exec(callExpression);
        if (!callMatch) continue;

        const parametersSource = callMatch[2].trim();
        const parameters = tryParseParameters(parametersSource);
        const expected = tryParseExpected(expectedRaw);

        if (parametersSource && expectedRaw) {
            tests.push({parameters, expected});
        }
    }

    return tests.length ? tests : undefined as any;
}

// безопасно парсим параметры как массив, но только из чисел и массивов чисел
function tryParseParameters(parametersSource: string): unknown[] | string {
    // Разрешаем только числа, запятые, пробелы, табы, квадратные скобки, минус и точку.
    const safeArgs = /^[\s,\[\]\-0-9.]+$/;
    if (safeArgs.test(parametersSource)) {
        try {
            // "80, 91, 37" → [80,91,37]
            return JSON.parse(`[${parametersSource}]`);
        } catch {
        }
    }
    return parametersSource;
}


// Пытаемся распарсить ожидаемое значение как число или массив чисел
function tryParseExpected(expectedRaw: string): unknown | string {
    const s = expectedRaw.trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) {
        return Number(s);
    }
    if (/^\[\s*[\d\.\-\s,]*\]$/.test(s)) {
        try {
            return JSON.parse(s);
        } catch {
        }
    }
    return s;
}

function unwrapHtmlComments(block: string): string {
    // Удаляет HTML-комментарии, оставляет содержимое, сохраняет переносы
    return block
        .replace(/\r\n?/g, '\n')
        .replace(/<!--\s*([\s\S]*?)\s*-->/g, '$1')
        .trim();
}

export function prepareEditorCodeFromSolution(solutionHtml: string): string {
    const withNormalizedNewlines = solutionHtml.replace(/\r\n?/g, '\n');

    // извлечь содержимое всех <script>...</script>
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scriptBodies: string[] = [];
    let scriptMatch: RegExpExecArray | null;
    while ((scriptMatch = scriptRegex.exec(withNormalizedNewlines))) {
        scriptBodies.push(scriptMatch[1]);
    }

    const withoutHtmlShell = scriptBodies.length
        ? scriptBodies.join('\n\n')
        : withNormalizedNewlines
            .replace(/<\/?html[^>]*>/gi, '')
            .replace(/<\/?head[^>]*>/gi, '')
            .replace(/<\/?body[^>]*>/gi, '');

    // снять HTML-комментарии и декодировать базовые сущности
    const withoutHtmlComments = withoutHtmlShell.replace(/<!--\s*|\s*-->/g, '');
    const withDecodedEntities = withoutHtmlComments
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    // превратить литералы "\n" и "\t" в реальные переносы и табы, если они есть
    const withRealNewlines = /\\n|\\t/.test(withDecodedEntities)
        ? withDecodedEntities.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
        : withDecodedEntities;

    // дедент
    const lines = withRealNewlines.split('\n');
    const indentSizes = lines
        .filter(line => line.trim().length > 0)
        .map(line => (line.match(/^[ \t]*/)?.[0].length ?? 0));
    const minIndent = indentSizes.length ? Math.min(...indentSizes) : 0;
    const dedented = minIndent
        ? lines.map(line => line.slice(minIndent)).join('\n')
        : withRealNewlines;

    return dedented.trim() + '\n';
}