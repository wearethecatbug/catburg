export type AssertResult = { isPassed: boolean; message: string };

function renderValue(value: unknown): string {
    try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = Object.prototype.hasOwnProperty.call(prototype, "constructor") ? prototype.constructor : undefined;
    return typeof constructor === "function" && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object);
}

/** Strict structural equality for JSON expectations; never coerces non-JSON runtime values. */
export function deepEqual(actual: unknown, expected: unknown): boolean {
    if (typeof actual !== typeof expected) return false;
    if (typeof actual === "number" && Number.isNaN(actual)) return false;
    if (typeof actual === "number") return actual === expected;
    if (actual === null || expected === null || typeof actual !== "object") return Object.is(actual, expected);
    if (Array.isArray(actual) !== Array.isArray(expected)) return false;
    if (Array.isArray(actual) && Array.isArray(expected)) {
        if (actual.length !== expected.length) return false;
        for (let index = 0; index < actual.length; index += 1) {
            if (!Object.prototype.hasOwnProperty.call(actual, index) || !Object.prototype.hasOwnProperty.call(expected, index) || !deepEqual(actual[index], expected[index])) return false;
        }
        return true;
    }
    if (!isJsonRecord(actual) || !isJsonRecord(expected)) return false;
    const actualRecord = actual;
    const expectedRecord = expected;
    const actualKeys = Object.keys(actualRecord);
    const expectedKeys = Object.keys(expectedRecord);
    return actualKeys.length === expectedKeys.length && expectedKeys.every(key => Object.prototype.hasOwnProperty.call(actualRecord, key) && deepEqual(actualRecord[key], expectedRecord[key]));
}

export function assertExpectedEqualsActual(actualValue: unknown, expectedValue: unknown, testNumber: number): AssertResult {
    if (deepEqual(actualValue, expectedValue)) return {isPassed: true, message: ""};
    return {isPassed: false, message: `Тест ${testNumber}:\nожидалось ${renderValue(expectedValue)}\nполучено ${renderValue(actualValue)}`};
}
