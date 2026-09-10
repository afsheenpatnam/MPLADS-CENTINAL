import { parse } from "csv-parse/sync";

/**
 * Parses a CSV buffer into an array of plain string-keyed records using the header row as keys.
 * Trims header/value whitespace and tolerates a trailing blank line. Throws a descriptive error
 * on malformed CSV (unbalanced quotes, inconsistent column counts) rather than silently dropping
 * rows.
 */
export function parseCsvBuffer(buffer: Buffer): Record<string, string>[] {
  const content = buffer.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM if present
  try {
    const records: Record<string, string>[] = parse(content, {
      columns: (header: string[]) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
    return records;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown CSV parse error";
    throw new Error(`Failed to parse CSV: ${message}`);
  }
}
