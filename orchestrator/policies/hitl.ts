export type HitlReason =
  | "missing-secret"
  | "destructive-change"
  | "repeated-test-failures"
  | "ambiguous-spec";

export interface HitlEvaluationInput {
  missingSecret?: boolean;
  destructiveChange?: boolean;
  failedTestAttempts?: number;
  ambiguousSpec?: boolean;
}

export interface HitlDecision {
  escalate: boolean;
  reason?: HitlReason;
  requestedInput?: string;
}

const DEFAULT_TEST_RETRY_LIMIT = 2;

export function evaluateHitl(
  input: HitlEvaluationInput,
  testRetryLimit: number = DEFAULT_TEST_RETRY_LIMIT,
): HitlDecision {
  if (input.missingSecret) {
    return {
      escalate: true,
      reason: "missing-secret",
      requestedInput: "Provide the required secret or credential.",
    };
  }

  if (input.destructiveChange) {
    return {
      escalate: true,
      reason: "destructive-change",
      requestedInput: "Confirm the change is approved or adjust the plan.",
    };
  }

  if ((input.failedTestAttempts ?? 0) >= testRetryLimit) {
    return {
      escalate: true,
      reason: "repeated-test-failures",
      requestedInput: "Share context on whether to retry tests or adjust the change.",
    };
  }

  if (input.ambiguousSpec) {
    return {
      escalate: true,
      reason: "ambiguous-spec",
      requestedInput: "Clarify scope or acceptance criteria before continuing.",
    };
  }

  return { escalate: false };
}

export interface Reservation {
  runId: string;
  workerId: string;
  reserved: boolean;
}

export function reserveWorker(runId: string, workerId: string): Reservation {
  return { runId, workerId, reserved: true };
}
