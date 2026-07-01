import { execFile, type ExecFileException } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';

export type MarkItDownInput = {
  buffer: Buffer;
  originalname?: string;
  filename?: string;
};

export type MarkItDownResult =
  | { ok: true; text: string }
  | { ok: false; message: string; stderr?: string };

type ExecFileFailure = {
  error: ExecFileException;
  stdout: string;
  stderr: string;
};

const diagnosticLimit = 1000;

function truncateDiagnostic(text: string) {
  return text.length > diagnosticLimit ? `${text.slice(0, diagnosticLimit)}...` : text;
}

function fileNameForInput(input: MarkItDownInput) {
  const candidate = input.originalname ?? input.filename ?? 'upload';
  return path.basename(candidate) || 'upload';
}

function runMarkItDown(command: string, inputPath: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject: (failure: ExecFileFailure) => void) => {
    execFile(
      command,
      [inputPath],
      {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: config.markitdownTimeoutMs,
      },
      (error, stdout, stderr) => {
        const output = {
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        };

        if (error) {
          reject({ error, ...output });
          return;
        }

        resolve(output);
      },
    );
  });
}

function readableExecFailure(command: string, failure: ExecFileFailure) {
  const { error, stderr } = failure;
  const code = typeof error.code === 'string' ? error.code : String(error.code ?? '');
  if (code === 'ENOENT') return `MarkItDown command not found: ${command}`;
  if (error.killed) return `MarkItDown timed out after ${config.markitdownTimeoutMs}ms`;

  const detail = truncateDiagnostic(stderr.trim() || error.message);
  return `MarkItDown failed${code ? ` (${code})` : ''}: ${detail}`;
}

export async function convertWithMarkItDown(input: MarkItDownInput): Promise<MarkItDownResult> {
  let tempDir = '';

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'interchange-markitdown-'));
    const inputPath = path.join(tempDir, fileNameForInput(input));
    await writeFile(inputPath, input.buffer);

    const { stdout, stderr } = await runMarkItDown(config.markitdownCommand, inputPath);
    const stderrText = truncateDiagnostic(stderr.trim());
    if (stderrText) {
      return { ok: false, message: `MarkItDown wrote to stderr: ${stderrText}`, stderr: stderrText };
    }

    const text = stdout.trim();
    if (!text) return { ok: false, message: 'MarkItDown returned empty output' };

    return { ok: true, text };
  } catch (error) {
    if (error && typeof error === 'object' && 'error' in error) {
      const failure = error as ExecFileFailure;
      return {
        ok: false,
        message: readableExecFailure(config.markitdownCommand, failure),
        stderr: truncateDiagnostic(failure.stderr.trim()) || undefined,
      };
    }

    const message = truncateDiagnostic(error instanceof Error ? error.message : String(error));
    return { ok: false, message: `MarkItDown could not run: ${message}` };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}
