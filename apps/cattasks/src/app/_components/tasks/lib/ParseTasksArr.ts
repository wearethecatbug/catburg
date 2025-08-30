export type ParsedTask = {
    id: string;          // уникальный slug
    no: number;          // порядковый номер
    title: string;       // сгенерированный заголовок
    description: string; // исходное описание (до решения)
    solution: string;    // HTML между маркерами
    test?: string;
};

// парсер: делает массив задач с title
export function parseTasksArr(raw: string): ParsedTask[] {
    const startRegExp = /<!--\s*(?:<!DOCTYPE html>|<html>)\s*-->/g;
    const endRegExp = /<!--\s*<\/html>\s*-->/g;

    const slugCounts = new Map<string, number>(); //счётчики по каждому слагу.
    const out: ParsedTask[] = [];

    let lastEnd = 0;
    let match: RegExpExecArray | null;

    while ((match = startRegExp.exec(raw))) {
        const solStart = match.index + match[0].length;
        endRegExp.lastIndex = solStart;
        const endMatch = endRegExp.exec(raw);
        if (!endMatch) break;

        const description = raw.slice(lastEnd, match.index).trim();
        const solution = raw.slice(solStart, endMatch.index).trim();

        if (description) {
            const title = makeTitle(description);
            const id = makeUniqueSlug(title, slugCounts);
            out.push({id, title, description, solution, no: out.length + 1});
        }
        lastEnd = endMatch.index + endMatch[0].length;
    }
    return out;
}


function makeTitle(desc: string): string {
    const clean = desc.replace(/<!--|-->/g, '').trim();
    const first = clean.split(/\r?\n/).find(Boolean) ?? 'Task';
    return first.length > 80 ? first.slice(0, 80) + '…' : first;
}


function makeUniqueSlug(title: string, used: Map<string, number>): string {
    let s = title.toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '') || 'task';
    const n = (used.get(s) ?? 0) + 1;
    used.set(s, n);
    return n === 1 ? s : `${s}-${n}`;
}
