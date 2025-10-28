export type CompiledUserFunction = {
    compiledFunction?: (...functionArguments: unknown[]) => unknown;
    errorMessage?: string;
};

export type AssertResult = { isPassed: boolean; message: string };

export type ParsedTest = {
    parameters?: unknown | unknown[];
    expected: unknown;
};

export type TestRunResult = {
    areAllTestsPassed: boolean;
    passedCount: number;
    totalTests: number;
    firstFailureMessage: string | null;
    resultText: string;
    errorMessage?: string;
};

export function stableStringify(value: unknown): string {
    return JSON.stringify(
        value,
        (_key, val) => {
            if (val && typeof val === "object" && !Array.isArray(val)) {
                const sorted: Record<string, unknown> = {};
                for (const key of Object.keys(val as Record<string, unknown>).sort()) {
                    sorted[key] = (val as Record<string, unknown>)[key];
                }
                return sorted;
            }
            return val;
        }
    ) ?? "";
}

export function deepEqual(a: unknown, b: unknown): boolean {
    if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
    return stableStringify(a) === stableStringify(b);
}

export function assertExpectedEqualsActual(
    actualValue: unknown,
    expectedValue: unknown,
    testNumber: number
): AssertResult {
    if (deepEqual(actualValue, expectedValue)) {
        return {isPassed: true, message: ""};
    }
    return {
        isPassed: false,
        message: `Тест ${testNumber}:\nожидалось ${stableStringify(expectedValue)}\nполучено ${stableStringify(actualValue)}`
    };
}

// ——— внутренние утилиты компиляции ———
function trimParameterList(text: string): string[] {
    return text.split(",").map(s => s.trim()).filter(Boolean);
}

function findBalancedBlock(source: string, openIndex: number): number {
    let depth = 0;
    let i = openIndex;
    let inSingle = false, inDouble = false, inBacktick = false;
    let inLineComment = false, inBlockComment = false;

    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];

        // комментарии
        if (!inSingle && !inDouble && !inBacktick) {
            if (!inBlockComment && !inLineComment && ch === "/" && next === "/") {
                inLineComment = true;
                i += 2;
                continue;
            }
            if (!inBlockComment && !inLineComment && ch === "/" && next === "*") {
                inBlockComment = true;
                i += 2;
                continue;
            }
            if (inLineComment && ch === "\n") {
                inLineComment = false;
                i++;
                continue;
            }
            if (inBlockComment && ch === "*" && next === "/") {
                inBlockComment = false;
                i += 2;
                continue;
            }
            if (inLineComment || inBlockComment) {
                i++;
                continue;
            }
        }

        // строки
        if (!inDouble && !inBacktick && ch === "'" && !inSingle) {
            inSingle = true;
            i++;
            continue;
        }
        if (inSingle && ch === "'") {
            inSingle = false;
            i++;
            continue;
        }

        if (!inSingle && !inBacktick && ch === '"' && !inDouble) {
            inDouble = true;
            i++;
            continue;
        }
        if (inDouble && ch === '"') {
            inDouble = false;
            i++;
            continue;
        }

        if (!inSingle && !inDouble && ch === "`" && !inBacktick) {
            inBacktick = true;
            i++;
            continue;
        }
        if (inBacktick && ch === "`") {
            inBacktick = false;
            i++;
            continue;
        }

        if (inSingle || inDouble || inBacktick) {
            i++;
            continue;
        }

        // баланс скобок
        if (ch === "{") {
            depth++;
        }
        if (ch === "}") {
            depth--;
            if (depth === 0) return i;
        }

        i++;
    }
    return -1;
}

function tryFunctionDeclaration(source: string, nameWanted?: string) {
    const regex = /function\s+([A-Za-z_$][\w$]*)\s*\(([^\)]*)\)\s*\{/g;
    const found: Array<{ name: string; params: string; body: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
        const name = match[1]!;
        const params = match[2] ?? "";
        const openIndex = match.index + match[0].lastIndexOf("{");
        const closeIndex = findBalancedBlock(source, openIndex);
        if (closeIndex < 0) continue;
        const body = source.slice(openIndex + 1, closeIndex);
        found.push({name, params, body});
    }
    if (nameWanted) return found.find(f => f.name === nameWanted) ?? null;
    if (found.length === 1) return found[0] ?? null;
    return null;
}

function tryFunctionExpression(source: string, nameWanted?: string) {
    const regex = /(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*\(([^\)]*)\)\s*\{/g;
    const found: Array<{ name: string; params: string; body: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
        const name = match[2]!;
        const params = match[3] ?? "";
        const openIndex = match.index + match[0].lastIndexOf("{");
        const closeIndex = findBalancedBlock(source, openIndex);
        if (closeIndex < 0) continue;
        const body = source.slice(openIndex + 1, closeIndex);
        found.push({name, params, body});
    }
    if (nameWanted) return found.find(f => f.name === nameWanted) ?? null;
    if (found.length === 1) return found[0] ?? null;
    return null;
}

function tryArrowBlock(source: string, nameWanted?: string) {
    const regex = /(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^\)]*)\)\s*=>\s*\{/g;
    const found: Array<{ name: string; params: string; body: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
        const name = match[2]!;
        const params = match[3] ?? "";
        const openIndex = match.index + match[0].lastIndexOf("{");
        const closeIndex = findBalancedBlock(source, openIndex);
        if (closeIndex < 0) continue;
        const body = source.slice(openIndex + 1, closeIndex);
        found.push({name, params, body});
    }
    if (nameWanted) return found.find(f => f.name === nameWanted) ?? null;
    if (found.length === 1) return found[0] ?? null;
    return null;
}

function tryArrowExpression(source: string, nameWanted?: string) {
    const regex = /(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(([^\)]*)\)|([A-Za-z_$][\w$]*))\s*=>\s*([^;]+);?/g;
    const found: Array<{ name: string; params: string; body: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
        const name = match[2]!;
        const params = (match[3] ?? match[4] ?? "").trim();
        const expr = match[5]!.trim();
        const body = `return (${expr});`;
        found.push({name, params, body});
    }
    if (nameWanted) return found.find(f => f.name === nameWanted) ?? null;
    if (found.length === 1) return found[0] ?? null;
    return null;
}

export function compileUserExportedFunction(
    userCode: string,
    expectedFunctionName?: string
): CompiledUserFunction {
    try {
        const picked =
            tryFunctionDeclaration(userCode, expectedFunctionName) ??
            tryFunctionExpression(userCode, expectedFunctionName) ??
            tryArrowBlock(userCode, expectedFunctionName) ??
            tryArrowExpression(userCode, expectedFunctionName);

        if (!picked) {
            return {
                errorMessage:
                    "Функция не найдена. Объявите её как function name(...) {...} или const name = (...) => {...} и, при необходимости, укажите имя в expectedFunctionName."
            };
        }

        const parameterList = trimParameterList(picked.params);
        const compiled = new Function(...parameterList, `"use strict";\n${picked.body}`) as (...a: unknown[]) => unknown;

        return {compiledFunction: compiled};
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {errorMessage: `Ошибка компиляции: ${message}`};
    }
}

function withConsoleSuppressed<T>(execute: () => T): T {
    // Browser-only: run in a hidden iframe with suppressed console
    if (typeof window !== "undefined" && typeof document !== "undefined") {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        const iframeWindow = iframe.contentWindow!;
        // Suppress console methods in the iframe
        iframeWindow.console.log = () => {};
        iframeWindow.console.warn = () => {};
        iframeWindow.console.error = () => {};
        iframeWindow.console.info = () => {};
        iframeWindow.console.debug = () => {};
        let result: T;
        try {
            // Run the code in the iframe context
            result = iframeWindow.eval("(" + execute.toString() + ")()") as T;
        } finally {
            document.body.removeChild(iframe);
        }
        return result;
    } else {
        // Fallback: original fragile suppression (Node.js or unknown env)
        const originalConsole = {...console};
        // @ts-expect-error переопределяем временно
        console.log = () => {};
        // @ts-expect-error
        console.warn = () => {};
        // @ts-expect-error
        console.error = () => {};
        // @ts-expect-error
        console.info = () => {};
        // @ts-expect-error
        console.debug = () => {};
        try {
            return execute();
        } finally {
            Object.assign(console, originalConsole);
        }
    }
}

export function runUserTests(
    userCode: string,
    tests: ParsedTest[],
    expectedFunctionName?: string,
    options?: { suppressConsoleOutput?: boolean }
): TestRunResult {
    if (!userCode.trim()) {
        const text = "Код пустой";
        return {
            areAllTestsPassed: false,
            passedCount: 0,
            totalTests: 0,
            firstFailureMessage: text,
            resultText: text,
            errorMessage: text
        };
    }

    if (!Array.isArray(tests) || tests.length === 0) {
        const text = "Нет тестов для проверки";
        return {
            areAllTestsPassed: false,
            passedCount: 0,
            totalTests: 0,
            firstFailureMessage: text,
            resultText: text,
            errorMessage: text
        };
    }

    const {compiledFunction, errorMessage} = compileUserExportedFunction(userCode, expectedFunctionName);
    if (errorMessage) {
        return {
            areAllTestsPassed: false,
            passedCount: 0,
            totalTests: tests.length,
            firstFailureMessage: errorMessage,
            resultText: errorMessage,
            errorMessage
        };
    }

    const executor = () => {
        let passedCount = 0;
        let firstFailureMessage: string | null = null;

        for (let index = 0; index < tests.length; index += 1) {
            const currentTest = tests[index]!;
            const parameters = currentTest.parameters;
            const expected = currentTest.expected;

            const normalizedArguments =
                Array.isArray(parameters) ? parameters :
                    parameters === undefined ? [] :
                        [parameters];

            let actual: unknown;
            try {
                actual = compiledFunction!(...normalizedArguments);
            } catch (callError) {
                firstFailureMessage = `Тест ${index + 1}: функция бросила ошибку: ${
                    callError instanceof Error ? callError.message : String(callError)
                }`;
                break;
            }

            const assertResult = assertExpectedEqualsActual(actual, expected, index + 1);
            if (assertResult.isPassed) {
                passedCount += 1;
            } else {
                firstFailureMessage = assertResult.message;
                break;
            }
        }

        const areAllTestsPassed = passedCount === tests.length;
        const resultText = areAllTestsPassed
            ? `Все тесты пройдены: ${passedCount}/${tests.length}`
            : `${firstFailureMessage ?? "Неизвестная ошибка"}\nПройдено: ${passedCount}/${tests.length}`;

        return {
            areAllTestsPassed,
            passedCount,
            totalTests: tests.length,
            firstFailureMessage,
            resultText
        } as TestRunResult;
    };

    return options?.suppressConsoleOutput ? withConsoleSuppressed(executor) : executor();
}