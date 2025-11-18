export interface WorkspacePaths {
  root: string;
  tempDir: string;
}

export function describeWorkspace(
  paths: WorkspacePaths,
): string {
  return `Workspace at ${paths.root} (temp: ${paths.tempDir})`;
}

