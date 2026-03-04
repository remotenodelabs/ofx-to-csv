import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { join } from 'path';

const CLI = join(__dirname, '../dist/cli.cjs');
const FIXTURES = join(__dirname, 'fixtures');

function run(args: string[]): string {
  return execFileSync('node', [CLI, ...args], { encoding: 'utf-8' });
}

describe('CLI', () => {
  it('shows help', () => {
    const out = run(['--help']);
    expect(out).toContain('ofx-to-csv');
    expect(out).toContain('--output');
    expect(out).toContain('--json');
  });

  it('shows version', () => {
    const out = run(['--version']);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exits with error when no files given', () => {
    expect(() => run([])).toThrow();
  });

  it('converts QBO to CSV', () => {
    const out = run([join(FIXTURES, 'Chase_Activity_20260201.QBO')]);
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('Date,Type,Amount,Name,Memo,Transaction ID,Check Number');
    expect(lines.length).toBe(20); // header + 19 transactions
  });

  it('converts QBO to JSON', () => {
    const out = run(['--json', join(FIXTURES, 'Chase_Activity_20260201.QBO')]);
    const data = JSON.parse(out);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].transactions).toHaveLength(19);
  });

  it('supports --no-header', () => {
    const out = run(['--no-header', join(FIXTURES, 'Chase_Activity_20260201.QBO')]);
    const lines = out.trim().split('\n');
    expect(lines.length).toBe(19); // no header
    expect(lines[0]).not.toContain('Date,Type');
  });

  it('supports US date format', () => {
    const out = run(['-d', 'US', join(FIXTURES, 'Chase_Activity_20260201.QBO')]);
    // US format: MM/DD/YYYY
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('supports EU date format', () => {
    const out = run(['-d', 'EU', join(FIXTURES, 'Chase_Activity_20260201.QBO')]);
    // EU format: DD/MM/YYYY
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('processes credit card QBO file', () => {
    const out = run([join(FIXTURES, 'Sample_CreditCard_20260201.QBO')]);
    expect(out).toContain('AMAZON MARKETPLACE');
    expect(out).toContain('-89.99');
  });

  it('handles multiple files', () => {
    const out = run([
      join(FIXTURES, 'Chase_Activity_20260201.QBO'),
      join(FIXTURES, 'Sample_CreditCard_20260201.QBO'),
    ]);
    // multi-statement adds Account column
    expect(out).toContain('Account');
    expect(out).toContain('555123456');
    expect(out).toContain('4532XXXXXXXX1234');
  });
});
