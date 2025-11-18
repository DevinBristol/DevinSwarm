export interface CiCheck {
  name: string;
  status: "pending" | "success" | "failure";
}

export function summarizeCiChecks(
  checks: CiCheck[],
): string {
  const summary = checks
    .map(
      (check) =>
        `${check.name}: ${check.status.toUpperCase()}`,
    )
    .join(", ");

  return summary || "no CI checks";
}

