export function summarizeCiChecks(checks) {
    const summary = checks
        .map((check) => `${check.name}: ${check.status.toUpperCase()}`)
        .join(", ");
    return summary || "no CI checks";
}
//# sourceMappingURL=ci.js.map