import type { OFXHeader, OFXTransaction, OFXAccount, OFXStatement, OFXParseResult } from './types.js';

// ============================================================================
// Header Parsing
// ============================================================================

export function parseOFXHeader(content: string): OFXHeader {
  if (content.trim().startsWith('<?xml') || content.trim().startsWith('<?OFX')) {
    return {
      version: '200',
      encoding: 'UTF-8',
      isXML: true,
    };
  }

  const header: OFXHeader = {
    version: '102',
    encoding: 'USASCII',
    charset: '1252',
    compression: 'NONE',
    isXML: false,
  };

  const headerLines = content.split('\n').slice(0, 15);
  for (const line of headerLines) {
    const [key, value] = line.split(':').map((s) => s.trim());
    if (!key || !value) continue;

    switch (key.toUpperCase()) {
      case 'VERSION':
        header.version = value;
        break;
      case 'ENCODING':
        header.encoding = value;
        break;
      case 'CHARSET':
        header.charset = value;
        break;
      case 'COMPRESSION':
        header.compression = value;
        break;
    }
  }

  return header;
}

// ============================================================================
// Date Parsing
// ============================================================================

export function parseOFXDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Empty date string');
  }

  const cleanDate = dateStr.replace(/\[.*?\]/g, '').trim();

  const year = parseInt(cleanDate.substring(0, 4), 10);
  const month = parseInt(cleanDate.substring(4, 6), 10) - 1;
  const day = parseInt(cleanDate.substring(6, 8), 10);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (cleanDate.length >= 10) {
    hours = parseInt(cleanDate.substring(8, 10), 10);
  }
  if (cleanDate.length >= 12) {
    minutes = parseInt(cleanDate.substring(10, 12), 10);
  }
  if (cleanDate.length >= 14) {
    seconds = parseInt(cleanDate.substring(12, 14), 10);
  }

  const date = new Date(year, month, day, hours, minutes, seconds);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return date;
}

// ============================================================================
// Tag Extraction Helpers
// ============================================================================

function extractTagValue(content: string, tagName: string): string | undefined {
  const closedPattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const closedMatch = content.match(closedPattern);
  if (closedMatch) {
    return closedMatch[1].trim();
  }

  const unclosedPattern = new RegExp(`<${tagName}>([^<\\n\\r]+)`, 'i');
  const unclosedMatch = content.match(unclosedPattern);
  if (unclosedMatch) {
    return unclosedMatch[1].trim();
  }

  return undefined;
}

function extractBlock(content: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = content.match(pattern);
  return match ? match[1] : undefined;
}

function extractAllBlocks(content: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'gi');
  const matches: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// ============================================================================
// Transaction Parsing
// ============================================================================

function parseTransaction(content: string): OFXTransaction {
  const type = extractTagValue(content, 'TRNTYPE') || 'OTHER';
  const datePostedStr = extractTagValue(content, 'DTPOSTED');
  const amountStr = extractTagValue(content, 'TRNAMT');
  const fitId = extractTagValue(content, 'FITID') || '';
  const name = extractTagValue(content, 'NAME');
  const memo = extractTagValue(content, 'MEMO');
  const checkNumber = extractTagValue(content, 'CHECKNUM');

  if (!datePostedStr) {
    throw new Error('Transaction missing DTPOSTED');
  }
  if (!amountStr) {
    throw new Error('Transaction missing TRNAMT');
  }

  return {
    type,
    datePosted: parseOFXDate(datePostedStr),
    amount: parseFloat(amountStr),
    fitId,
    name,
    memo,
    checkNumber,
  };
}

// ============================================================================
// Statement Parsing
// ============================================================================

export function parseBankStatement(content: string): OFXStatement | null {
  const stmtrs = extractBlock(content, 'STMTRS');
  if (!stmtrs) return null;

  const currency = extractTagValue(stmtrs, 'CURDEF') || 'USD';

  const bankAcctFrom = extractBlock(stmtrs, 'BANKACCTFROM');
  const account: OFXAccount = {
    bankId: bankAcctFrom ? extractTagValue(bankAcctFrom, 'BANKID') : undefined,
    accountId: bankAcctFrom ? extractTagValue(bankAcctFrom, 'ACCTID') || '' : '',
    accountType: bankAcctFrom ? extractTagValue(bankAcctFrom, 'ACCTTYPE') || 'CHECKING' : 'CHECKING',
  };

  const bankTranList = extractBlock(stmtrs, 'BANKTRANLIST');
  let startDate = new Date();
  let endDate = new Date();
  const transactions: OFXTransaction[] = [];

  if (bankTranList) {
    const dtStart = extractTagValue(bankTranList, 'DTSTART');
    const dtEnd = extractTagValue(bankTranList, 'DTEND');
    if (dtStart) startDate = parseOFXDate(dtStart);
    if (dtEnd) endDate = parseOFXDate(dtEnd);

    const txnBlocks = extractAllBlocks(bankTranList, 'STMTTRN');
    for (const txnBlock of txnBlocks) {
      try {
        transactions.push(parseTransaction(txnBlock));
      } catch {
        // Skip malformed transactions
      }
    }
  }

  let ledgerBalance: { amount: number; asOfDate: Date } | undefined;
  const ledgerBalBlock = extractBlock(stmtrs, 'LEDGERBAL');
  if (ledgerBalBlock) {
    const balAmt = extractTagValue(ledgerBalBlock, 'BALAMT');
    const dtAsOf = extractTagValue(ledgerBalBlock, 'DTASOF');
    if (balAmt && dtAsOf) {
      ledgerBalance = {
        amount: parseFloat(balAmt),
        asOfDate: parseOFXDate(dtAsOf),
      };
    }
  }

  let availableBalance: { amount: number; asOfDate: Date } | undefined;
  const availBalBlock = extractBlock(stmtrs, 'AVAILBAL');
  if (availBalBlock) {
    const balAmt = extractTagValue(availBalBlock, 'BALAMT');
    const dtAsOf = extractTagValue(availBalBlock, 'DTASOF');
    if (balAmt && dtAsOf) {
      availableBalance = {
        amount: parseFloat(balAmt),
        asOfDate: parseOFXDate(dtAsOf),
      };
    }
  }

  return {
    account,
    currency,
    period: { startDate, endDate },
    transactions,
    ledgerBalance,
    availableBalance,
  };
}

export function parseCreditCardStatement(content: string): OFXStatement | null {
  const ccstmtrs = extractBlock(content, 'CCSTMTRS');
  if (!ccstmtrs) return null;

  const currency = extractTagValue(ccstmtrs, 'CURDEF') || 'USD';

  const ccAcctFrom = extractBlock(ccstmtrs, 'CCACCTFROM');
  const account: OFXAccount = {
    accountId: ccAcctFrom ? extractTagValue(ccAcctFrom, 'ACCTID') || '' : '',
    accountType: 'CREDITCARD',
  };

  const bankTranList = extractBlock(ccstmtrs, 'BANKTRANLIST');
  let startDate = new Date();
  let endDate = new Date();
  const transactions: OFXTransaction[] = [];

  if (bankTranList) {
    const dtStart = extractTagValue(bankTranList, 'DTSTART');
    const dtEnd = extractTagValue(bankTranList, 'DTEND');
    if (dtStart) startDate = parseOFXDate(dtStart);
    if (dtEnd) endDate = parseOFXDate(dtEnd);

    const txnBlocks = extractAllBlocks(bankTranList, 'STMTTRN');
    for (const txnBlock of txnBlocks) {
      try {
        transactions.push(parseTransaction(txnBlock));
      } catch {
        // Skip malformed transactions
      }
    }
  }

  let ledgerBalance: { amount: number; asOfDate: Date } | undefined;
  const ledgerBalBlock = extractBlock(ccstmtrs, 'LEDGERBAL');
  if (ledgerBalBlock) {
    const balAmt = extractTagValue(ledgerBalBlock, 'BALAMT');
    const dtAsOf = extractTagValue(ledgerBalBlock, 'DTASOF');
    if (balAmt && dtAsOf) {
      ledgerBalance = {
        amount: parseFloat(balAmt),
        asOfDate: parseOFXDate(dtAsOf),
      };
    }
  }

  let availableBalance: { amount: number; asOfDate: Date } | undefined;
  const availBalBlock = extractBlock(ccstmtrs, 'AVAILBAL');
  if (availBalBlock) {
    const balAmt = extractTagValue(availBalBlock, 'BALAMT');
    const dtAsOf = extractTagValue(availBalBlock, 'DTASOF');
    if (balAmt && dtAsOf) {
      availableBalance = {
        amount: parseFloat(balAmt),
        asOfDate: parseOFXDate(dtAsOf),
      };
    }
  }

  return {
    account,
    currency,
    period: { startDate, endDate },
    transactions,
    ledgerBalance,
    availableBalance,
  };
}

// ============================================================================
// Main Parser
// ============================================================================

export function parseOFX(content: string): OFXParseResult {
  const errors: string[] = [];
  const statements: OFXStatement[] = [];

  const header = parseOFXHeader(content);

  const bankStmtBlocks = extractAllBlocks(content, 'STMTTRNRS');
  for (const block of bankStmtBlocks) {
    const statement = parseBankStatement(block);
    if (statement) {
      statements.push(statement);
    }
  }

  const ccStmtBlocks = extractAllBlocks(content, 'CCSTMTTRNRS');
  for (const block of ccStmtBlocks) {
    const statement = parseCreditCardStatement(block);
    if (statement) {
      statements.push(statement);
    }
  }

  if (statements.length === 0) {
    const directBankStmt = parseBankStatement(content);
    if (directBankStmt) {
      statements.push(directBankStmt);
    }

    const directCCStmt = parseCreditCardStatement(content);
    if (directCCStmt) {
      statements.push(directCCStmt);
    }
  }

  if (statements.length === 0) {
    errors.push('No valid statements found in file');
  }

  return {
    header,
    statements,
    errors,
  };
}

/** @deprecated Use parseOFX instead */
export const parseQBO = parseOFX;
