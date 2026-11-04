import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(appRoot, "public");
const catalogPath = path.join(publicRoot, "task-catalog.v1.json");
const provenancePath = path.join(publicRoot, "task-catalog.provenance.v1.json");
const reportPath = path.join(publicRoot, "task-catalog.migration-report.v1.json");
const rawSources = ["tasks.txt", "tasks2", "сodeWarsTasks.txt"];
const curated = new Map([["tasks.txt", [
    {locator: "L1-L45", id: "race"},
    {locator: "L48-L74", id: "digitize"},
    {locator: "L76-L96", id: "no-space"},
]]]);

function fail(message) {
    throw new Error(`task catalog validation failed: ${message}`);
}

function hash(source) {
    return createHash("sha256").update(source).digest("hex").toUpperCase();
}

function locator(start, end) {
    return `L${start}-L${end}`;
}

function reportRecords(sourceName, source) {
    const lines = source.split(/\r?\n/);
    const imported = curated.get(sourceName) ?? [];
    if (imported.length) {
        return [
            {locator: "L1-L45", status: "curated", catalogId: "race", issues: []},
            {locator: "L46-L47", status: "excluded", issues: ["Blank separator outside a legacy task record."]},
            {locator: "L48-L74", status: "curated", catalogId: "digitize", issues: []},
            {locator: "L75-L75", status: "excluded", issues: ["Blank separator outside a legacy task record."]},
            {locator: "L76-L96", status: "curated", catalogId: "no-space", issues: []},
        ];
    }
    const ends = lines.flatMap((line, index) => /<!--\s*<\/html>\s*-->/.test(line) ? [index + 1] : []);
    const records = [];
    let start = 1;
    for (const end of ends) {
        records.push({locator: locator(start, end), status: "excluded", issues: ["Excluded from runnable catalog: no source-backed curation decision."]});
        start = end + 1;
    }
    if (start <= lines.length) records.push({locator: locator(start, lines.length), status: "excluded", issues: ["Excluded residual source text: no unambiguous legacy record boundary."]});
    return records;
}

async function buildReport() {
    const sources = await Promise.all(rawSources.map(async source => {
        const raw = await readFile(path.join(publicRoot, source), "utf8");
        return {source, sha256: hash(raw), lineCount: raw.split(/\r?\n/).length, records: reportRecords(source, raw)};
    }));
    return {version: 1, catalog: "task-catalog.v1.json", sources};
}

function requireObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
}

function syntaxCheck(code, label) {
    const source = ts.createSourceFile(label, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    if (source.parseDiagnostics.length) fail(`${label} has JavaScript syntax errors`);
    return source;
}

function hasEntryPoint(source, entryPoint) {
    return source.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === entryPoint);
}

function validateCatalog(catalog, provenance, report) {
    requireObject(catalog, "catalog");
    if (catalog.version !== 1 || !Array.isArray(catalog.tasks) || catalog.tasks.length !== 3) fail("catalog must contain exactly three version 1 tasks");
    const ids = new Set();
    for (const [index, task] of catalog.tasks.entries()) {
        requireObject(task, `catalog.tasks[${index}]`);
        for (const field of ["id", "title", "description", "entryPoint", "starterCode", "solution"]) {
            if (typeof task[field] !== "string" || !task[field].trim()) fail(`catalog.tasks[${index}].${field} must be a non-empty string`);
        }
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(task.entryPoint)) fail(`catalog.tasks[${index}].entryPoint is not an identifier`);
        if (ids.has(task.id)) fail(`catalog.tasks[${index}].id is duplicated`);
        ids.add(task.id);
        if (!Array.isArray(task.tests) || !task.tests.length) fail(`catalog.tasks[${index}].tests must be non-empty`);
        for (const test of task.tests) {
            requireObject(test, `catalog.tasks[${index}].tests[]`);
            if (!Array.isArray(test.args) || !("expected" in test)) fail(`catalog.tasks[${index}].tests[] must contain args and expected`);
        }
        if (!hasEntryPoint(syntaxCheck(task.starterCode, `${task.id} starterCode`), task.entryPoint)) fail(`${task.id} starterCode does not declare ${task.entryPoint}`);
        if (!hasEntryPoint(syntaxCheck(task.solution, `${task.id} solution`), task.entryPoint)) fail(`${task.id} solution does not declare ${task.entryPoint}`);
    }
    if ([...ids].sort().join(",") !== "digitize,no-space,race") fail("catalog IDs must be race, digitize, and no-space");
    requireObject(provenance, "provenance");
    if (provenance.version !== 1 || provenance.catalog !== "task-catalog.v1.json" || !Array.isArray(provenance.records)) fail("provenance shape is invalid");
    if (provenance.records.length !== ids.size || new Set(provenance.records.map(record => record.id)).size !== ids.size) fail("provenance must cover every catalog task once");
    for (const record of provenance.records) {
        if (!ids.has(record.id) || record.source !== "tasks.txt" || !/^L\d+-L\d+$/.test(record.locator) || !Array.isArray(record.corrections)) fail("provenance record is invalid");
        for (const correction of record.corrections) if (!["sourceLocator", "original", "replacement", "reason"].every(field => typeof correction[field] === "string" && correction[field])) fail(`provenance correction for ${record.id} is incomplete`);
    }
    const curatedRecords = report.sources.flatMap(source => source.records.filter(record => record.status === "curated"));
    if (curatedRecords.length !== ids.size || curatedRecords.some(record => !ids.has(record.catalogId))) fail("migration report curated records do not match catalog IDs");
}

const write = process.argv.includes("--write");
const [catalog, provenance] = await Promise.all([catalogPath, provenancePath].map(async file => JSON.parse(await readFile(file, "utf8"))));
const expectedReport = await buildReport();
if (write) {
    await writeFile(reportPath, `${JSON.stringify(expectedReport, null, 2)}\n`);
} else {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (JSON.stringify(report) !== JSON.stringify(expectedReport)) fail("migration report is stale; run scripts/validate-task-catalog.mjs --write");
}
validateCatalog(catalog, provenance, expectedReport);
console.log("task catalog validation passed");
