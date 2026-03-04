# ofx-to-csv

[![CI](https://github.com/remotenodelabs/ofx-to-csv/actions/workflows/ci.yml/badge.svg)](https://github.com/remotenodelabs/ofx-to-csv/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ofx-to-csv.svg)](https://www.npmjs.com/package/ofx-to-csv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Convert OFX/QBO bank statements to CSV. Zero-dependency TypeScript parser + CLI tool.

## Quick Start

### CLI

```bash
# Run directly with npx
npx ofx-to-csv statement.qbo

# Or install globally
npm install -g ofx-to-csv
ofx-to-csv statement.qbo -o output.csv
```

### Library

```typescript
import { parseOFX, toCSV } from 'ofx-to-csv';

const result = parseOFX(fileContent);
const csv = toCSV(result.statements[0].transactions, { dateFormat: 'US' });
```

## CLI Usage

```
ofx-to-csv [options] <file...>

Options:
  -o, --output <file>       Write to file (default: stdout)
  -d, --date-format <fmt>   ISO (default), US, EU
  -j, --json                Output JSON instead of CSV
  --no-header               Omit CSV header row
  --fields <list>           Comma-separated field names
  -v, --version             Show version
  -h, --help                Show help
```

### Examples

```bash
# Basic conversion
ofx-to-csv statement.qbo

# US date format, write to file
ofx-to-csv statement.qbo -o output.csv -d US

# JSON output
ofx-to-csv statement.qbo --json

# Pipe from stdin
cat statement.qbo | ofx-to-csv -

# Multiple files
ofx-to-csv checking.qbo savings.qbo -o combined.csv

# Select specific fields
ofx-to-csv statement.qbo --fields datePosted,amount,name
```

## API Reference

### `parseOFX(content: string): OFXParseResult`

Parse an OFX/QBO file content string.

```typescript
interface OFXParseResult {
  header: OFXHeader;
  statements: OFXStatement[];
  errors: string[];
}
```

### `toCSV(transactions: OFXTransaction[], options?: ExportOptions): string`

Convert transactions to CSV string.

```typescript
interface ExportOptions {
  includeHeader?: boolean;    // default: true
  dateFormat?: 'ISO' | 'US' | 'EU';  // default: 'ISO'
  columns?: (keyof OFXTransaction)[];
}
```

### `statementsToCSV(statements: OFXStatement[], options?: ExportOptions): string`

Convert multiple statements to CSV with an Account column.

### Types

```typescript
interface OFXTransaction {
  type: string;
  datePosted: Date;
  amount: number;
  fitId: string;
  name?: string;
  memo?: string;
  checkNumber?: string;
}

interface OFXStatement {
  account: OFXAccount;
  currency: string;
  period: { startDate: Date; endDate: Date };
  transactions: OFXTransaction[];
  ledgerBalance?: { amount: number; asOfDate: Date };
  availableBalance?: { amount: number; asOfDate: Date };
}
```

QBO type aliases (`QBOTransaction`, `QBOStatement`, etc.) are also exported for discoverability.

## FAQ

**What's the difference between OFX and QBO?**
QBO is Quicken's proprietary extension of the OFX (Open Financial Exchange) format. This library handles both.

**Does this support OFX XML format?**
Yes. Both SGML (OFX 1.x) and XML (OFX 2.x) formats are supported.

**Are there any runtime dependencies?**
No. Zero runtime dependencies. Only dev dependencies for building and testing.

## Development

### Testing

```bash
# Install dependencies
npm install

# Run tests once (CI-style)
npm run test:run

# Run tests in watch mode (re-runs on file changes)
npm test
```

- **`npm run test:run`** — Run the full test suite once. Use this before committing or in CI.
- **`npm test`** — Run tests in watch mode; re-runs when you save files. Use this while developing.

Tests live in `test/` and use [Vitest](https://vitest.dev/).

## License

MIT
