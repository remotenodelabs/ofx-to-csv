import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseOFXDate,
  parseOFXHeader,
  parseOFX,
  parseBankStatement,
  parseCreditCardStatement,
} from '../src/index.js';

// ============================================================================
// Date Parsing Tests
// ============================================================================

describe('parseOFXDate', () => {
  it('parses full datetime with timezone bracket', () => {
    const date = parseOFXDate('20250430120000[0:GMT]');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(12);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it('parses full datetime without timezone', () => {
    const date = parseOFXDate('20250430120000');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(12);
  });

  it('parses date only format', () => {
    const date = parseOFXDate('20250430');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(0);
  });

  it('parses date with negative timezone offset', () => {
    const tz = ['[', '-5', ':', 'EST', ']'].join('');
    const date = parseOFXDate('20250430120000' + tz);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(30);
  });

  it('throws on empty date string', () => {
    expect(() => parseOFXDate('')).toThrow('Empty date string');
  });

  it('throws on invalid date', () => {
    expect(() => parseOFXDate('notadate')).toThrow();
  });
});

// ============================================================================
// Header Parsing Tests
// ============================================================================

describe('parseOFXHeader', () => {
  it('parses SGML header', () => {
    const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>`;

    const header = parseOFXHeader(content);
    expect(header.isXML).toBe(false);
    expect(header.version).toBe('102');
    expect(header.encoding).toBe('USASCII');
    expect(header.charset).toBe('1252');
    expect(header.compression).toBe('NONE');
  });

  it('parses XML header', () => {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>`;

    const header = parseOFXHeader(content);
    expect(header.isXML).toBe(true);
    expect(header.encoding).toBe('UTF-8');
  });

  it('parses OFX XML declaration', () => {
    const content = `<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>`;

    const header = parseOFXHeader(content);
    expect(header.isXML).toBe(true);
  });
});

// ============================================================================
// Transaction Parsing Tests
// ============================================================================

describe('parseOFX transaction parsing', () => {
  it('parses DEBIT transaction', () => {
    const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>987654321
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250415120000
<TRNAMT>-100.50
<FITID>12345
<NAME>Test Merchant
<MEMO>Purchase at store
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].transactions).toHaveLength(1);

    const txn = result.statements[0].transactions[0];
    expect(txn.type).toBe('DEBIT');
    expect(txn.amount).toBe(-100.5);
    expect(txn.fitId).toBe('12345');
    expect(txn.name).toBe('Test Merchant');
    expect(txn.memo).toBe('Purchase at store');
  });

  it('parses CREDIT transaction', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>123
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250415
<TRNAMT>500.00
<FITID>67890
<NAME>Deposit
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    const txn = result.statements[0].transactions[0];
    expect(txn.type).toBe('CREDIT');
    expect(txn.amount).toBe(500);
  });

  it('handles missing optional fields', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>123
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250415
<TRNAMT>-50
<FITID>111
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    const txn = result.statements[0].transactions[0];
    expect(txn.name).toBeUndefined();
    expect(txn.memo).toBeUndefined();
    expect(txn.checkNumber).toBeUndefined();
  });

  it('parses CHECK transaction with check number', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>123
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>CHECK
<DTPOSTED>20250415
<TRNAMT>-200
<FITID>222
<CHECKNUM>1234
<NAME>Check Payment
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    const txn = result.statements[0].transactions[0];
    expect(txn.type).toBe('CHECK');
    expect(txn.checkNumber).toBe('1234');
  });
});

// ============================================================================
// Statement Parsing Tests
// ============================================================================

describe('parseBankStatement', () => {
  it('parses bank account info', () => {
    const content = `<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>555123456
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5000.00
<DTASOF>20250430
</LEDGERBAL>
</STMTRS>`;

    const statement = parseBankStatement(content);
    expect(statement).not.toBeNull();
    expect(statement!.account.bankId).toBe('123456789');
    expect(statement!.account.accountId).toBe('555123456');
    expect(statement!.account.accountType).toBe('CHECKING');
    expect(statement!.currency).toBe('USD');
    expect(statement!.ledgerBalance?.amount).toBe(5000);
  });
});

describe('parseCreditCardStatement', () => {
  it('parses credit card statement', () => {
    const content = `<CCSTMTRS>
<CURDEF>USD
<CCACCTFROM>
<ACCTID>4111111111111111
</CCACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250415
<TRNAMT>-75.00
<FITID>CC001
<NAME>Online Purchase
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>-500.00
<DTASOF>20250430
</LEDGERBAL>
</CCSTMTRS>`;

    const statement = parseCreditCardStatement(content);
    expect(statement).not.toBeNull();
    expect(statement!.account.accountType).toBe('CREDITCARD');
    expect(statement!.account.accountId).toBe('4111111111111111');
    expect(statement!.transactions).toHaveLength(1);
    expect(statement!.ledgerBalance?.amount).toBe(-500);
  });
});

// ============================================================================
// Multi-Account Tests
// ============================================================================

describe('multi-account parsing', () => {
  it('parses multiple bank accounts', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>111111
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250415
<TRNAMT>-100
<FITID>A1
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>222222
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250420
<TRNAMT>200
<FITID>B1
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0].account.accountId).toBe('111111');
    expect(result.statements[0].account.accountType).toBe('CHECKING');
    expect(result.statements[1].account.accountId).toBe('222222');
    expect(result.statements[1].account.accountType).toBe('SAVINGS');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles empty transaction list', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>123
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].transactions).toHaveLength(0);
  });

  it('reports error for empty file', () => {
    const result = parseOFX('');
    expect(result.errors).toContain('No valid statements found in file');
  });

  it('handles special characters in name/memo', () => {
    const content = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<ACCTID>123
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20250401
<DTEND>20250430
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250415
<TRNAMT>-50
<FITID>333
<NAME>Test & Co. "Special"
<MEMO>Note: 50% off!
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseOFX(content);
    const txn = result.statements[0].transactions[0];
    expect(txn.name).toBe('Test & Co. "Special"');
    expect(txn.memo).toBe('Note: 50% off!');
  });
});

// ============================================================================
// Real File Tests
// ============================================================================

describe('real QBO file parsing - bank account', () => {
  it('parses Chase_Activity_20260201.QBO correctly', () => {
    const filePath = join(__dirname, 'fixtures/Chase_Activity_20260201.QBO');
    const content = readFileSync(filePath, 'utf-8');

    const result = parseOFX(content);

    expect(result.errors).toHaveLength(0);
    expect(result.statements).toHaveLength(1);

    const statement = result.statements[0];

    expect(statement.account.bankId).toBe('123456789');
    expect(statement.account.accountId).toBe('555123456');
    expect(statement.account.accountType).toBe('CHECKING');
    expect(statement.currency).toBe('USD');
    expect(statement.transactions).toHaveLength(19);

    const firstTxn = statement.transactions[0];
    expect(firstTxn.type).toBe('DEBIT');
    expect(firstTxn.amount).toBe(-655.89);
    expect(firstTxn.name).toBe('ACME TRANSFER    WIRE       TrfW');

    const creditTxn = statement.transactions.find((t) => t.type === 'CREDIT');
    expect(creditTxn).toBeDefined();
    expect(creditTxn!.amount).toBeGreaterThan(0);

    expect(statement.ledgerBalance).toBeDefined();
    expect(statement.ledgerBalance!.amount).toBe(5887.39);
  });
});

describe('real QBO file parsing - credit card', () => {
  it('parses Sample_CreditCard_20260201.QBO correctly', () => {
    const filePath = join(__dirname, 'fixtures/Sample_CreditCard_20260201.QBO');
    const content = readFileSync(filePath, 'utf-8');

    const result = parseOFX(content);

    expect(result.errors).toHaveLength(0);
    expect(result.statements).toHaveLength(1);

    const statement = result.statements[0];

    expect(statement.account.bankId).toBeUndefined();
    expect(statement.account.accountId).toBe('4532XXXXXXXX1234');
    expect(statement.account.accountType).toBe('CREDITCARD');
    expect(statement.currency).toBe('USD');
    expect(statement.transactions).toHaveLength(12);

    const firstTxn = statement.transactions[0];
    expect(firstTxn.type).toBe('DEBIT');
    expect(firstTxn.amount).toBe(-89.99);
    expect(firstTxn.name).toBe('AMAZON MARKETPLACE');
    expect(firstTxn.memo).toBe('AMZN.COM/BILL WA');

    const creditTxns = statement.transactions.filter((t) => t.type === 'CREDIT');
    expect(creditTxns).toHaveLength(2);

    const payment = creditTxns.find((t) => t.name === 'PAYMENT RECEIVED');
    expect(payment).toBeDefined();
    expect(payment!.amount).toBe(50.0);

    const refund = creditTxns.find((t) => t.name === 'RETURN CREDIT');
    expect(refund).toBeDefined();
    expect(refund!.amount).toBe(25.0);

    expect(statement.ledgerBalance).toBeDefined();
    expect(statement.ledgerBalance!.amount).toBe(-676.22);

    expect(statement.availableBalance).toBeDefined();
    expect(statement.availableBalance!.amount).toBe(4323.78);
  });

  it('correctly identifies various merchant types', () => {
    const filePath = join(__dirname, 'fixtures/Sample_CreditCard_20260201.QBO');
    const content = readFileSync(filePath, 'utf-8');

    const result = parseOFX(content);
    const transactions = result.statements[0].transactions;

    const merchantNames = transactions.map((t) => t.name);
    expect(merchantNames).toContain('AMAZON MARKETPLACE');
    expect(merchantNames).toContain('UBER EATS');
    expect(merchantNames).toContain('COSTCO WHOLESALE');
    expect(merchantNames).toContain('NETFLIX');
    expect(merchantNames).toContain('SPOTIFY');
    expect(merchantNames).toContain('WHOLE FOODS MARKET');
  });
});

// ============================================================================
// QBO Alias Tests
// ============================================================================

describe('QBO backward compatibility', () => {
  it('parseQBO alias works', async () => {
    const { parseQBO } = await import('../src/index.js');
    const result = parseQBO('');
    expect(result.errors).toContain('No valid statements found in file');
  });
});
