import type { OFXTransaction, OFXStatement, ExportOptions } from './types.js';
import { formatDate, escapeCSV } from './formatter.js';

const COLUMN_HEADERS: Record<keyof OFXTransaction, string> = {
  datePosted: 'Date',
  type: 'Type',
  amount: 'Amount',
  name: 'Name',
  memo: 'Memo',
  fitId: 'Transaction ID',
  checkNumber: 'Check Number',
};

const DEFAULT_COLUMNS: (keyof OFXTransaction)[] = [
  'datePosted',
  'type',
  'amount',
  'name',
  'memo',
  'fitId',
  'checkNumber',
];

export function toCSV(
  transactions: OFXTransaction[],
  options: ExportOptions = {}
): string {
  const { includeHeader = true, dateFormat = 'ISO', columns } = options;
  const cols = columns || DEFAULT_COLUMNS;
  const rows: string[] = [];

  if (includeHeader) {
    const headerRow = cols.map((col) => COLUMN_HEADERS[col] || col).join(',');
    rows.push(headerRow);
  }

  for (const txn of transactions) {
    const row = cols.map((col) => {
      if (col === 'datePosted') {
        return escapeCSV(formatDate(txn.datePosted, dateFormat));
      }
      return escapeCSV(txn[col]);
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export function statementsToCSV(
  statements: OFXStatement[],
  options: ExportOptions = {}
): string {
  const { includeHeader = true, dateFormat = 'ISO', columns } = options;
  const cols = columns || DEFAULT_COLUMNS;
  const rows: string[] = [];

  if (includeHeader) {
    const headerRow = ['Account', ...cols.map((col) => COLUMN_HEADERS[col] || col)].join(',');
    rows.push(headerRow);
  }

  for (const stmt of statements) {
    const accountLabel = stmt.account.accountId;
    for (const txn of stmt.transactions) {
      const row = [
        escapeCSV(accountLabel),
        ...cols.map((col) => {
          if (col === 'datePosted') {
            return escapeCSV(formatDate(txn.datePosted, dateFormat));
          }
          return escapeCSV(txn[col]);
        }),
      ];
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

/** @deprecated Use toCSV instead */
export const transactionsToCSV = toCSV;
