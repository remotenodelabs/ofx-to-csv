import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { parseOFX } from './parser.js';
import { toCSV, statementsToCSV } from './csv.js';
import type { ExportOptions } from './types.js';

const VERSION = '0.1.0';

const HELP = `
ofx-to-csv [options] <file...>

Convert OFX/QBO bank statements to CSV or JSON.

Options:
  -o, --output <file>       Write to file (default: stdout)
  -d, --date-format <fmt>   ISO (default), US, EU
  -j, --json                Output JSON instead of CSV
  --no-header               Omit CSV header row
  --fields <list>           Comma-separated field names
  -v, --version             Show version
  -h, --help                Show help

Examples:
  ofx-to-csv statement.qbo
  ofx-to-csv statement.qbo -o output.csv -d US
  cat statement.qbo | ofx-to-csv -
`.trim();

interface CLIOptions {
  files: string[];
  output?: string;
  dateFormat: 'ISO' | 'US' | 'EU';
  json: boolean;
  includeHeader: boolean;
  fields?: string[];
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CLIOptions {
  const opts: CLIOptions = {
    files: [],
    dateFormat: 'ISO',
    json: false,
    includeHeader: true,
    help: false,
    version: false,
  };

  const args = argv.slice(2);
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      case '-o':
      case '--output':
        opts.output = args[++i];
        break;
      case '-d':
      case '--date-format': {
        const fmt = args[++i]?.toUpperCase();
        if (fmt === 'ISO' || fmt === 'US' || fmt === 'EU') {
          opts.dateFormat = fmt;
        } else {
          process.stderr.write(`Invalid date format: ${fmt}. Use ISO, US, or EU.\n`);
          process.exit(1);
        }
        break;
      }
      case '-j':
      case '--json':
        opts.json = true;
        break;
      case '--no-header':
        opts.includeHeader = false;
        break;
      case '--fields':
        opts.fields = args[++i]?.split(',').map((f) => f.trim());
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') {
          process.stderr.write(`Unknown option: ${arg}\n`);
          process.exit(1);
        }
        opts.files.push(arg);
        break;
    }
    i++;
  }

  return opts;
}

function readInput(file: string): string {
  if (file === '-') {
    return readFileSync(0, 'utf-8');
  }
  return readFileSync(file, 'utf-8');
}

function main(): void {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    process.stdout.write(HELP + '\n');
    return;
  }

  if (opts.version) {
    process.stdout.write(VERSION + '\n');
    return;
  }

  if (opts.files.length === 0) {
    process.stderr.write('Error: No input files specified. Use --help for usage.\n');
    process.exit(1);
  }

  const exportOpts: ExportOptions = {
    includeHeader: opts.includeHeader,
    dateFormat: opts.dateFormat,
  };

  if (opts.fields) {
    exportOpts.columns = opts.fields as (keyof import('./types.js').OFXTransaction)[];
  }

  const allResults = opts.files.map((file) => {
    const content = readInput(file);
    return parseOFX(content);
  });

  // Collect all errors
  for (const result of allResults) {
    for (const err of result.errors) {
      process.stderr.write(`Warning: ${err}\n`);
    }
  }

  let output: string;

  if (opts.json) {
    const allStatements = allResults.flatMap((r) => r.statements);
    output = JSON.stringify(allStatements, null, 2);
  } else {
    const allStatements = allResults.flatMap((r) => r.statements);
    if (allStatements.length === 1) {
      output = toCSV(allStatements[0].transactions, exportOpts);
    } else {
      output = statementsToCSV(allStatements, exportOpts);
    }
  }

  if (opts.output) {
    writeFileSync(opts.output, output + '\n', 'utf-8');
  } else {
    process.stdout.write(output + '\n');
  }
}

main();
