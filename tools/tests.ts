export interface TestRunResult {
  success: boolean;
  output: string;
}

export async function runTests(
  command: string,
  options?: { cwd?: string },
): Promise<TestRunResult> {
  // Stubbed for now; real implementation will shell out with timeouts.
  return {
    success: true,
    output: `Stub test runner skipped command: ${command} in ${options?.cwd ?? "cwd"}`,
  };
}
