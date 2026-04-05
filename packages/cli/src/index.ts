import { parseArgs } from "node:util";
import { openDatabase } from "./storage.js";
import { verify } from "./commands/verify.js";
import { inspect } from "./commands/inspect.js";
import { list } from "./commands/list.js";
import { stats } from "./commands/stats.js";

const USAGE = `gridseal - Chain verification and inspection CLI

Usage:
  gridseal verify <db> --chain <id> [--entry <id>] [--subtree]
  gridseal inspect <db> --entry <id> [--json]
  gridseal list <db> [--chain <id>] [--limit <n>]
  gridseal stats <db> --chain <id>

Commands:
  verify     Verify chain integrity (full chain, single entry, or subtree)
  inspect    Show detailed entry information
  list       List chains or entries within a chain
  stats      Show chain statistics

Options:
  --chain <id>    Chain ID to operate on
  --entry <id>    Entry ID for single-entry operations
  --subtree       Validate entire subtree (with verify --entry)
  --json          Output in JSON format (with inspect)
  --limit <n>     Limit number of entries shown (with list)
  --help          Show this help message
  --version       Show version
`;

const VERSION = "0.1.0";

type ParsedArgs = {
  readonly command: string;
  readonly dbPath: string;
  readonly chainId?: string | undefined;
  readonly entryId?: string | undefined;
  readonly subtree: boolean;
  readonly json: boolean;
  readonly limit?: number | undefined;
};

function parseCliArgs(argv: ReadonlyArray<string>): ParsedArgs | null {
  const args = parseArgs({
    args: argv as Array<string>,
    options: {
      chain: { type: "string" },
      entry: { type: "string" },
      subtree: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      limit: { type: "string" },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (args.values.help) {
    process.stdout.write(USAGE);
    return null;
  }

  if (args.values.version) {
    process.stdout.write(`gridseal ${VERSION}\n`);
    return null;
  }

  const positionals = args.positionals;
  const command = positionals[0];
  const dbPath = positionals[1];

  if (!command || !dbPath) {
    process.stderr.write("Error: command and database path are required\n\n");
    process.stderr.write(USAGE);
    process.exitCode = 1;
    return null;
  }

  const limitStr = args.values.limit;
  const limit = limitStr !== undefined ? parseInt(limitStr, 10) : undefined;
  if (limit !== undefined && (isNaN(limit) || limit < 1)) {
    process.stderr.write("Error: --limit must be a positive integer\n");
    process.exitCode = 1;
    return null;
  }

  return {
    command,
    dbPath,
    chainId: args.values.chain,
    entryId: args.values.entry,
    subtree: args.values.subtree ?? false,
    json: args.values.json ?? false,
    limit,
  };
}

async function run(argv: ReadonlyArray<string>): Promise<void> {
  const parsed = parseCliArgs(argv);
  if (!parsed) {
    return;
  }

  const { command, dbPath, chainId, entryId, subtree, json, limit } = parsed;

  let storage;
  try {
    storage = openDatabase(dbPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${msg}\n`);
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "verify": {
      if (!chainId) {
        process.stderr.write("Error: --chain is required for verify\n");
        process.exitCode = 1;
        return;
      }
      const result = await verify({ storage, chainId, entryId, subtree });
      if (result.success) {
        process.stdout.write(`${result.message}\n`);
      } else {
        process.stderr.write(`${result.message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "inspect": {
      if (!entryId) {
        process.stderr.write("Error: --entry is required for inspect\n");
        process.exitCode = 1;
        return;
      }
      const result = await inspect({ storage, entryId, json });
      if (result.success) {
        process.stdout.write(`${result.message}\n`);
      } else {
        process.stderr.write(`${result.message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "list": {
      const result = await list({ storage, chainId, limit });
      if (result.success) {
        process.stdout.write(`${result.message}\n`);
      } else {
        process.stderr.write(`${result.message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    case "stats": {
      if (!chainId) {
        process.stderr.write("Error: --chain is required for stats\n");
        process.exitCode = 1;
        return;
      }
      const result = await stats({ storage, chainId });
      if (result.success) {
        process.stdout.write(`${result.message}\n`);
      } else {
        process.stderr.write(`${result.message}\n`);
        process.exitCode = 1;
      }
      return;
    }
    default:
      process.stderr.write(`Error: unknown command '${command}'\n\n`);
      process.stderr.write(USAGE);
      process.exitCode = 1;
  }
}

run(process.argv.slice(2)).catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`Fatal error: ${msg}\n`);
  process.exitCode = 1;
});
