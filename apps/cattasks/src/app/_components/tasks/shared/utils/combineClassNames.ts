export function combineClassNames(
    ...parts: Array<string | false | null | undefined>
): string {
    return parts.filter(Boolean).join(' ');
}