import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface TestRunResult {
  success: boolean;
  output: string;
}

const execAsync = promisify(exec);

export async function runTests(
  command: string,
  options?: { cwd?: string; timeoutMs?: number },
): Promise<TestRunResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.cwd,
      timeout: options?.timeoutMs ?? 10 * 60 * 1000,
      env: process.env,
      maxBuffer: 5 * 1024 * 1024, // 5MB to capture useful logs without hanging
    });

    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    return {
      success: true,
      output,
    };
  } catch (err: any) {
    const outputParts = [
      err.stdout,
      err.stderr,
      err.message && `error: ${err.message}`,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    return {
      success: false,
      output: outputParts || "Test command failed with no output",
    };
  }
}
