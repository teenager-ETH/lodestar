import childProcess from "node:child_process";
import type {Argv} from "yargs";
import {
  ExecChildProcessOptions,
  SpawnChildProcessOptions,
  execChildProcess,
  spawnChildProcess,
} from "./childProcess.js";
import {nodeJsBinaryPath, repoRootPath} from "./path.js";
import {wrapTimeout} from "./timeout.js";

// We need to make it easy for the user to pass the args for the CLI
// yargs treat `["--preset minimal"] as a single arg, so we need to split it ["--preset", "minimal"]
function parseArgs(args: string[]): string[] {
  return args.flatMap((a) => a.split(" "));
}

type CommandRunOptions = {
  timeoutMs: number;
};

/**
 * Run the cli command inside the main process from the Yargs object
 */
export async function runCliCommand<T>(
  cli: Argv<T>,
  args: string[],
  opts: CommandRunOptions = {timeoutMs: 1000}
): Promise<string> {
  return wrapTimeout(
    // biome-ignore lint/suspicious/noAsyncPromiseExecutor: We want to resolve with parser call back not on main promise
    new Promise(async (resolve, reject) => {
      try {
        await cli
          .parseAsync(parseArgs(args), {}, (err, _argv, output) => {
            if (err) return reject(err);

            resolve(output);
          })
          .catch(() => {
            // We are suppressing error here as we are throwing from inside the callback
          });
      } catch (err) {
        reject(err);
      }
    }),
    opts.timeoutMs
  );
}

/**
 * Exec a command in bash script mode. Useful for short-running commands
 *
 * @param command - The command should be relative to mono-repo root
 * @param args
 * @param opts
 * @returns
 */
export function execCliCommand(
  command: string,
  args: string[],
  opts?: ExecChildProcessOptions & {runWith?: "node" | "ts-node"}
): Promise<string> {
  const commandPrefixed = nodeJsBinaryPath;

  const argsPrefixed =
    opts?.runWith === "ts-node"
      ? // node --loader ts-node/esm cli.ts
        ["--loader", "ts-node/esm", repoRootPath(command), ...args]
      : // node cli.js
        [repoRootPath(command), ...args];

  return execChildProcess([commandPrefixed, ...parseArgs(argsPrefixed)], opts);
}

/**
 * Spawn a process and keep it running
 *
 * @param command - The command should be relative to mono-repo root
 * @param args
 * @param opts
 * @returns
 */
export async function spawnCliCommand(
  command: string,
  args: string[],
  opts?: SpawnChildProcessOptions & {runWith?: "node" | "ts-node"}
): Promise<childProcess.ChildProcessWithoutNullStreams> {
  const commandPrefixed = nodeJsBinaryPath;

  const argsPrefixed =
    opts?.runWith === "ts-node"
      ? // node --loader ts-node/esm cli.ts
        ["--loader", "ts-node/esm", repoRootPath(command), ...args]
      : // node cli.js
        [repoRootPath(command), ...args];

  return spawnChildProcess(commandPrefixed, parseArgs(argsPrefixed), opts);
}
