import Database from "better-sqlite3";

export interface RunRecord {
  id: string;
  status: string;
  description: string;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export class SqliteRunStore {
  private db: any;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.initialize();
  }

  private initialize(): void {
    this.db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          description TEXT NOT NULL,
          result_summary TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      )
      .run();
  }

  createRun(record: RunRecord): void {
    const statement = this.db.prepare(
      `
      INSERT INTO runs (
        id,
        status,
        description,
        result_summary,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @status,
        @description,
        @resultSummary,
        @createdAt,
        @updatedAt
      )
    `,
    );

    statement.run({
      ...record,
      resultSummary: record.resultSummary ?? null,
    });
  }

  updateRun(
    id: string,
    updates: Pick<
      RunRecord,
      "status" | "resultSummary" | "updatedAt"
    >,
  ): void {
    const statement = this.db.prepare(
      `
      UPDATE runs
      SET
        status = COALESCE(@status, status),
        result_summary = COALESCE(@resultSummary, result_summary),
        updated_at = @updatedAt
      WHERE id = @id
    `,
    );

    statement.run({
      id,
      status: updates.status,
      resultSummary: updates.resultSummary ?? null,
      updatedAt: updates.updatedAt,
    });
  }

  getRun(id: string): RunRecord | undefined {
    const statement = this.db.prepare(
      `
      SELECT
        id,
        status,
        description,
        result_summary as resultSummary,
        created_at as createdAt,
        updated_at as updatedAt
      FROM runs
      WHERE id = ?
    `,
    );

    const row = statement.get(id) as
      | RunRecord
      | undefined;

    return row;
  }

  listRuns(limit = 50): RunRecord[] {
    const statement = this.db.prepare(
      `
      SELECT
        id,
        status,
        description,
        result_summary as resultSummary,
        created_at as createdAt,
        updated_at as updatedAt
      FROM runs
      ORDER BY created_at DESC
      LIMIT ?
    `,
    );

    const rows = statement.all(limit) as RunRecord[];

    return rows;
  }
}
