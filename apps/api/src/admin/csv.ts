export class CsvFormatError extends Error {}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  const input = text.startsWith('\uFEFF') ? text.slice(1) : text;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      if (fieldStarted) {
        throw new CsvFormatError(
          `Unexpected quote in row ${rows.length + 1}; wrap the whole field in quotes`,
        );
      }
      quoted = true;
      fieldStarted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      fieldStarted = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStarted = false;
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (quoted) {
    throw new CsvFormatError('CSV ends inside a quoted field');
  }
  if (fieldStarted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export function csvRecords(
  text: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) {
    throw new CsvFormatError('CSV is empty');
  }
  const columns = header.map((name) => name.trim());
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    throw new CsvFormatError(`Missing CSV columns: ${missing.join(', ')}`);
  }
  const unknown = columns.filter((name) => !allowed.has(name));
  if (unknown.length > 0) {
    throw new CsvFormatError(`Unknown CSV columns: ${unknown.join(', ')}`);
  }
  if (new Set(columns).size !== columns.length) {
    throw new CsvFormatError('CSV has duplicate column names');
  }
  return body.map((cells, index) => {
    if (cells.length !== columns.length) {
      throw new CsvFormatError(
        `Row ${index + 2} has ${cells.length} fields; expected ${columns.length}`,
      );
    }
    return Object.fromEntries(
      columns.map((name, column) => [name, cells[column].trim()]),
    );
  });
}

// Spreadsheet apps execute cells that start with these characters as formulas.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'string'
        ? value
        : typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? String(value)
          : JSON.stringify(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv<T extends object>(
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
