import { CsvFormatError, csvRecords, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted fields, escaped quotes, CRLF, and a BOM', () => {
    expect(
      parseCsv('\uFEFFname,note\r\n"Desk, oak","He said ""hi"""\r\nLamp,\n'),
    ).toEqual([
      ['name', 'note'],
      ['Desk, oak', 'He said "hi"'],
      ['Lamp', ''],
    ]);
  });

  it('keeps line breaks inside quoted fields', () => {
    expect(parseCsv('a\n"line 1\nline 2"')).toEqual([
      ['a'],
      ['line 1\nline 2'],
    ]);
  });

  it('skips blank rows', () => {
    expect(parseCsv('a,b\n\n , \n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it.each(['a,b"c', '"open'])('rejects malformed quoting %j', (text) => {
    expect(() => parseCsv(text)).toThrow(CsvFormatError);
  });
});

describe('csvRecords', () => {
  it('maps rows to trimmed records', () => {
    expect(
      csvRecords(' name , price \n Desk , 10.00 ', ['name', 'price']),
    ).toEqual([{ name: 'Desk', price: '10.00' }]);
  });

  it('accepts optional columns in any order', () => {
    expect(csvRecords('note,name\nx,Desk', ['name'], ['note'])).toEqual([
      { name: 'Desk', note: 'x' },
    ]);
  });

  it.each([
    ['', 'CSV is empty'],
    ['name', 'Missing CSV columns: price'],
    ['name,price,extra', 'Unknown CSV columns: extra'],
    ['name,price,name', 'duplicate column'],
    ['name,price\nDesk', 'Row 2 has 1 fields; expected 2'],
  ])('rejects %j', (text, message) => {
    expect(() => csvRecords(text, ['name', 'price'])).toThrow(message);
  });
});

describe('toCsv', () => {
  it('escapes delimiters and serialises dates, nulls, and booleans', () => {
    const rows = [
      {
        name: 'Desk, "oak"',
        active: true,
        note: null,
        at: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    expect(toCsv(['name', 'active', 'note', 'at'], rows)).toBe(
      'name,active,note,at\r\n"Desk, ""oak""",true,,2026-01-01T00:00:00.000Z\r\n',
    );
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx'])(
    'neutralises spreadsheet formula %j',
    (value) => {
      expect(toCsv(['v'], [{ v: value }]).split('\r\n')[1]).toMatch(/^"?'/);
    },
  );

  it('does not prefix negative numbers stored as numbers', () => {
    expect(toCsv(['v'], [{ v: -5 }])).toBe('v\r\n-5\r\n');
  });

  it('round-trips through parseCsv', () => {
    const rows = [{ a: 'x\ny', b: 'p,q' }];
    expect(parseCsv(toCsv(['a', 'b'], rows))).toEqual([
      ['a', 'b'],
      ['x\ny', 'p,q'],
    ]);
  });
});
