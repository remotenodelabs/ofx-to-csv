import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOFX, toCSV, statementsToCSV } from '../src/index.js';
import type { OFXTransaction } from '../src/index.js';

// ============================================================================
// CSV Export Tests
// ============================================================================

describe('toCSV', () => {
  const sampleTransactions: OFXTransaction[] = [
    {
      type: 'DEBIT',
      datePosted: new Date(2025, 3, 15),
      amount: -100.5,
      fitId: '12345',
      name: 'Test Merchant',
      memo: 'Test purchase',
    },
    {
      type: 'CREDIT',
      datePosted: new Date(2025, 3, 20),
      amount: 500,
      fitId: '67890',
      name: 'Deposit',
    },
  ];

  it('generates CSV with header', () => {
    const csv = toCSV(sampleTransactions);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Date,Type,Amount,Name,Memo,Transaction ID,Check Number');
    expect(lines).toHaveLength(3);
  });

  it('generates CSV without header', () => {
    const csv = toCSV(sampleTransactions, { includeHeader: false });
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
  });

  it('formats dates in ISO format by default', () => {
    const csv = toCSV(sampleTransactions);
    expect(csv).toContain('2025-04-15');
  });

  it('formats dates in US format', () => {
    const csv = toCSV(sampleTransactions, { dateFormat: 'US' });
    expect(csv).toContain('04/15/2025');
  });

  it('formats dates in EU format', () => {
    const csv = toCSV(sampleTransactions, { dateFormat: 'EU' });
    expect(csv).toContain('15/04/2025');
  });

  it('escapes commas in values', () => {
    const txns: OFXTransaction[] = [
      {
        type: 'DEBIT',
        datePosted: new Date(2025, 3, 15),
        amount: -50,
        fitId: '111',
        name: 'Test, Inc.',
      },
    ];

    const csv = toCSV(txns);
    expect(csv).toContain('"Test, Inc."');
  });

  it('escapes quotes in values', () => {
    const txns: OFXTransaction[] = [
      {
        type: 'DEBIT',
        datePosted: new Date(2025, 3, 15),
        amount: -50,
        fitId: '111',
        name: 'Test "Quoted"',
      },
    ];

    const csv = toCSV(txns);
    expect(csv).toContain('"Test ""Quoted"""');
  });

  it('exports credit card transactions to CSV correctly', () => {
    const filePath = join(__dirname, 'fixtures/Sample_CreditCard_20260201.QBO');
    const content = readFileSync(filePath, 'utf-8');

    const result = parseOFX(content);
    const csv = toCSV(result.statements[0].transactions);

    expect(csv).toContain('AMAZON MARKETPLACE');
    expect(csv).toContain('-89.99');
    expect(csv).toContain('PAYMENT RECEIVED');
    expect(csv).toContain('50');
  });
});

// ============================================================================
// statementsToCSV Tests
// ============================================================================

describe('statementsToCSV', () => {
  it('includes Account column for multi-statement output', () => {
    const txns: OFXTransaction[] = [
      {
        type: 'DEBIT',
        datePosted: new Date(2025, 3, 15),
        amount: -50,
        fitId: '111',
        name: 'Test',
      },
    ];

    const csv = statementsToCSV([
      {
        account: { accountId: 'ACCT1', accountType: 'CHECKING' },
        currency: 'USD',
        period: { startDate: new Date(), endDate: new Date() },
        transactions: txns,
      },
      {
        account: { accountId: 'ACCT2', accountType: 'SAVINGS' },
        currency: 'USD',
        period: { startDate: new Date(), endDate: new Date() },
        transactions: txns,
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toContain('Account');
    expect(lines[1]).toContain('ACCT1');
    expect(lines[2]).toContain('ACCT2');
  });
});

// ============================================================================
// transactionsToCSV alias
// ============================================================================

describe('transactionsToCSV alias', () => {
  it('works as alias for toCSV', async () => {
    const { transactionsToCSV } = await import('../src/index.js');
    const csv = transactionsToCSV([
      {
        type: 'DEBIT',
        datePosted: new Date(2025, 0, 1),
        amount: -10,
        fitId: '1',
        name: 'Test',
      },
    ]);
    expect(csv).toContain('Test');
    expect(csv).toContain('-10');
  });
});
