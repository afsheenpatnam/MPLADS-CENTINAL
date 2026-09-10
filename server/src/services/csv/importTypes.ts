export interface RowIssue {
  row: number; // 1-indexed data row (header excluded)
  field?: string;
  message: string;
}

export interface ImportSummary<TResult> {
  totalRows: number;
  validRows: number;
  invalidRows: RowIssue[];
  warnings: RowIssue[];
  results: TResult[];
  importBatchId: string;
}

export function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return ["true", "yes", "1", "y"].includes(value.trim().toLowerCase());
}
