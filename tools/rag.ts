export interface RagQuery {
  query: string;
  topK: number;
}

export interface RagResult {
  id: string;
  score: number;
  snippet: string;
}

export function describeRagQuery(
  input: RagQuery,
): string {
  return `RAG query "${input.query}" (topK=${input.topK})`;
}

