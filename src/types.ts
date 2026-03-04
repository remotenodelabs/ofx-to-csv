export interface OFXTransaction {
  type: string;
  datePosted: Date;
  amount: number;
  fitId: string;
  name?: string;
  memo?: string;
  checkNumber?: string;
}

export interface OFXAccount {
  bankId?: string;
  accountId: string;
  accountType: string;
}

export interface OFXStatement {
  account: OFXAccount;
  currency: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  transactions: OFXTransaction[];
  ledgerBalance?: {
    amount: number;
    asOfDate: Date;
  };
  availableBalance?: {
    amount: number;
    asOfDate: Date;
  };
}

export interface OFXHeader {
  version: string;
  encoding: string;
  charset?: string;
  compression?: string;
  isXML: boolean;
}

export interface OFXParseResult {
  header: OFXHeader;
  statements: OFXStatement[];
  errors: string[];
}

export interface ExportOptions {
  includeHeader?: boolean;
  dateFormat?: 'ISO' | 'US' | 'EU';
  columns?: (keyof OFXTransaction)[];
}

// QBO aliases for discoverability
export type QBOTransaction = OFXTransaction;
export type QBOAccount = OFXAccount;
export type QBOStatement = OFXStatement;
export type QBOParseResult = OFXParseResult;
