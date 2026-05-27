import { execFile } from "node:child_process";

export function runCommand(command, args = [], options = {}) {
  const timeout = options.timeout ?? 15000;

  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}
