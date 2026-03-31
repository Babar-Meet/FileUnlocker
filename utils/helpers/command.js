import { spawn } from "node:child_process";

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    const onData = (chunk) => chunk.toString();

    child.stdout.on("data", (chunk) => {
      stdout += onData(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += onData(chunk);
    });

    let timeoutId;
    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        const timeoutError = new Error(`Command timed out: ${command}`);
        timeoutError.stdout = stdout;
        timeoutError.stderr = stderr;
        timeoutError.exitCode = -1;
        reject(timeoutError);
      }, options.timeoutMs);
    }

    child.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const spawnError = new Error(error.message);
      spawnError.stdout = stdout;
      spawnError.stderr = stderr;
      spawnError.exitCode = -1;
      reject(spawnError);
    });

    child.on("close", (exitCode) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
        return;
      }

      const executionError = new Error(
        stderr || stdout || `${command} exited with code ${exitCode}`,
      );
      executionError.stdout = stdout;
      executionError.stderr = stderr;
      executionError.exitCode = exitCode;
      reject(executionError);
    });
  });
}
