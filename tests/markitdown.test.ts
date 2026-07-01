import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecFileException } from 'node:child_process';
import { convertWithMarkItDown } from '../server/markitdown.js';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: execFileMock,
  };
});

describe('convertWithMarkItDown', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs the MarkItDown CLI with a temp file and returns trimmed stdout', async () => {
    mockMarkItDown({ stdout: '  # Release notes\n\n- Preserve Markdown  \n' });

    const result = await convertWithMarkItDown({
      originalname: 'release.docx',
      buffer: Buffer.from('docx-ish'),
    });

    expect(result).toEqual({ ok: true, text: '# Release notes\n\n- Preserve Markdown' });
    expect(execFileMock).toHaveBeenCalledWith(
      'markitdown',
      [expect.stringMatching(/release\.docx$/)],
      expect.objectContaining({ timeout: 30000 }),
      expect.any(Function),
    );
  });

  it('returns a failure result when MarkItDown output is empty', async () => {
    mockMarkItDown({ stdout: '   \n  ' });

    await expect(convertWithMarkItDown({ originalname: 'empty.pdf', buffer: Buffer.from('') })).resolves.toEqual({
      ok: false,
      message: 'MarkItDown returned empty output',
    });
  });

  it('returns a failure result when the MarkItDown command is missing', async () => {
    mockMarkItDown({
      error: Object.assign(new Error('spawn markitdown ENOENT'), { code: 'ENOENT' }) as ExecFileException,
    });

    await expect(convertWithMarkItDown({ originalname: 'brief.pdf', buffer: Buffer.from('pdf-ish') })).resolves.toEqual({
      ok: false,
      message: 'MarkItDown command not found: markitdown',
    });
  });

  it('truncates stderr in failure diagnostics', async () => {
    const stderr = 'x'.repeat(1500);
    mockMarkItDown({
      error: Object.assign(new Error('Command failed'), { code: 1 }) as ExecFileException,
      stderr,
    });

    const result = await convertWithMarkItDown({ originalname: 'brief.pdf', buffer: Buffer.from('pdf-ish') });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeLessThan(stderr.length);
      expect(result.stderr).toHaveLength(1003);
      expect(result.stderr).toMatch(/\.\.\.$/);
    }
  });
});

function mockMarkItDown({
  error = null,
  stdout = '',
  stderr = '',
}: {
  error?: ExecFileException | null;
  stdout?: string;
  stderr?: string;
}) {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: unknown,
      callback: (error: ExecFileException | null, stdout?: string, stderr?: string) => void,
    ) => {
      callback(error, stdout, stderr);
      return {};
    },
  );
}
