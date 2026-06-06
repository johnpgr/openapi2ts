import fs from 'fs';
import path from 'path';
import type {Openapi2tsConfig} from '../schema-to-typescript/config.ts';

export const CLI_USAGE = `Usage:
  openapi2ts generate [config]
  openapi2ts check [config]
  openapi2ts generate --url <url> --out <dir>
  openapi2ts generate --file <path> --out <dir>
  openapi2ts check --url <url> --out <dir>
  openapi2ts check --file <path> --out <dir>

Options:
  --url <url>        OpenAPI JSON document URL (quick mode)
  --file <path>      OpenAPI JSON document file (quick mode)
  --out, -o <dir>    Output directory (required in quick mode)
  --name <name>      Client class name (quick mode, default: ApiClient)
  --base-url <url>   Generated client base URL (quick mode)
  -h, --help         Show help

When [config] is omitted, the CLI looks for a config file in the current working directory:
  openapi2ts.config.ts, .mts, .cts, .mjs, .cjs, .js
`;

export const DEFAULT_CONFIG_FILES = [
    'openapi2ts.config.ts',
    'openapi2ts.config.mts',
    'openapi2ts.config.cts',
    'openapi2ts.config.mjs',
    'openapi2ts.config.cjs',
    'openapi2ts.config.js'
] as const;

export type CliCommand = 'generate' | 'check';

export interface CliQuickOptions {
    url?: string;
    file?: string;
    out: string;
    name?: string;
    baseUrl?: string;
}

export type ParseCliArgsResult =
    | {kind: 'help'}
    | {kind: 'error'; message: string}
    | {
          kind: 'success';
          command: CliCommand;
          mode: 'config';
          configPath: string;
      }
    | {
          kind: 'success';
          command: CliCommand;
          mode: 'discover';
      }
    | {
          kind: 'success';
          command: CliCommand;
          mode: 'quick';
          quick: CliQuickOptions;
      };

const FLAGS_WITH_VALUE = new Set(['--url', '--file', '--out', '-o', '--name', '--base-url']);
const QUICK_FLAGS = new Set(['--url', '--file', '--out', '--name', '--base-url']);

export function parseCliArgs(argv: string[]): ParseCliArgsResult {
    if (argv.includes('-h') || argv.includes('--help')) {
        return {kind: 'help'};
    }

    const [command, ...rest] = argv;
    if (!command || (command !== 'generate' && command !== 'check')) {
        return {kind: 'error', message: 'Unknown command. Valid commands: generate, check.'};
    }

    const flags: Record<string, string> = {};
    const positionals: string[] = [];

    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i]!;
        if (arg === '-h' || arg === '--help') {
            return {kind: 'help'};
        }
        if (arg.startsWith('-')) {
            if (!FLAGS_WITH_VALUE.has(arg)) {
                return {kind: 'error', message: `Unknown flag: ${arg}`};
            }
            const value = rest[++i];
            if (value === undefined || value.startsWith('-')) {
                return {kind: 'error', message: `Missing value for ${arg}.`};
            }
            const key = arg === '-o' ? '--out' : arg;
            flags[key] = value;
            continue;
        }
        positionals.push(arg);
    }

    if (positionals.length > 1) {
        return {kind: 'error', message: 'Unexpected extra arguments.'};
    }

    const configPath = positionals[0];
    const hasQuickFlags = [...QUICK_FLAGS].some((flag) => flag in flags);

    if (configPath && hasQuickFlags) {
        return {
            kind: 'error',
            message: 'Config file cannot be combined with --url, --file, --out, --name, or --base-url.'
        };
    }

    if ('--url' in flags && '--file' in flags) {
        return {kind: 'error', message: '--url and --file are mutually exclusive.'};
    }

    const hasSource = '--url' in flags || '--file' in flags;
    const hasOut = '--out' in flags;
    const hasOtherQuickFlags = '--name' in flags || '--base-url' in flags;

    if (hasSource || hasOut || hasOtherQuickFlags) {
        if (!hasSource) {
            return {kind: 'error', message: 'Quick mode requires --url or --file.'};
        }
        if (!hasOut) {
            return {kind: 'error', message: 'Quick mode requires --out.'};
        }
        return {
            kind: 'success',
            command,
            mode: 'quick',
            quick: {
                url: flags['--url'],
                file: flags['--file'],
                out: flags['--out']!,
                name: flags['--name'],
                baseUrl: flags['--base-url']
            }
        };
    }

    if (configPath) {
        return {kind: 'success', command, mode: 'config', configPath};
    }

    return {kind: 'success', command, mode: 'discover'};
}

export function discoverConfigFile(
    cwd: string,
    exists: (filename: string) => boolean = (filename) => fs.existsSync(filename)
): string | null {
    for (const filename of DEFAULT_CONFIG_FILES) {
        const fullPath = path.join(cwd, filename);
        if (exists(fullPath)) {
            return filename;
        }
    }
    return null;
}

export function buildQuickConfig(quick: CliQuickOptions): Openapi2tsConfig {
    const client: {name: string; baseUrl?: string} = {
        name: quick.name ?? 'ApiClient'
    };
    if (quick.baseUrl !== undefined) {
        client.baseUrl = quick.baseUrl;
    }

    return {
        generates: [
            {
                type: 'openapiClient',
                document: {
                    source: quick.url
                        ? {type: 'url', url: quick.url}
                        : {type: 'file', path: quick.file!}
                },
                outputDirPath: quick.out,
                client
            }
        ]
    };
}
