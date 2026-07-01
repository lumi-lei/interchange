import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExecFileException } from 'node:child_process';

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

describe('parser MarkItDown integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Markdown text when MarkItDown succeeds for ordinary documents', async () => {
    mockMarkItDown({ stdout: '  # Release notes\n\n- Preserve Markdown  \n' });
    const { parseUploadedFile } = await import('../server/parser.js');

    const parsed = await parseUploadedFile(upload('release.docx', 'not really docx'));

    expect(parsed).toEqual({
      sourceType: 'word',
      filename: 'release.docx',
      text: '# Release notes\n\n- Preserve Markdown',
    });
    expect(execFileMock).toHaveBeenCalledWith(
      'markitdown',
      [expect.stringMatching(/release\.docx$/)],
      expect.objectContaining({ timeout: 30000 }),
      expect.any(Function),
    );
  });

  it('falls back to the existing parser when MarkItDown fails', async () => {
    mockMarkItDown({
      error: Object.assign(new Error('Command failed'), { code: 1 }) as ExecFileException,
      stderr: 'conversion failed',
    });
    const { parseUploadedFile } = await import('../server/parser.js');

    const parsed = await parseUploadedFile(upload('data.csv', 'name,value\nalpha,1', 'text/csv'));

    expect(parsed).toEqual({
      sourceType: 'excel',
      filename: 'data.csv',
      text: 'name,value\nalpha,1',
    });
  });

  it('falls back to the existing parser when MarkItDown output is empty', async () => {
    mockMarkItDown({ stdout: '   \n  ' });
    const { parseUploadedFile } = await import('../server/parser.js');

    const parsed = await parseUploadedFile(upload('data.csv', 'name,value\nalpha,1', 'text/csv'));

    expect(parsed.text).toBe('name,value\nalpha,1');
  });

  it('supports .xls when MarkItDown can convert it', async () => {
    mockMarkItDown({ stdout: '| Name | Value |\n| --- | --- |\n| alpha | 1 |' });
    const { parseUploadedFile } = await import('../server/parser.js');

    const parsed = await parseUploadedFile(upload('legacy.xls', 'binary-ish'));

    expect(parsed).toEqual({
      sourceType: 'excel',
      filename: 'legacy.xls',
      text: '| Name | Value |\n| --- | --- |\n| alpha | 1 |',
    });
  });

  it('keeps the existing .xls 415 fallback when MarkItDown fails', async () => {
    mockMarkItDown({
      error: Object.assign(new Error('spawn markitdown ENOENT'), { code: 'ENOENT' }) as ExecFileException,
    });
    const { parseUploadedFile } = await import('../server/parser.js');

    await expect(parseUploadedFile(upload('legacy.xls', 'binary-ish'))).rejects.toMatchObject({
      status: 415,
      message: expect.stringContaining('Legacy .xls files are not supported yet'),
    });
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
  execFileMock.mockImplementationOnce((_command, _args, _options, callback) => {
    callback(error, stdout, stderr);
    return {};
  });
}

function upload(filename: string, content: string, mimetype = 'application/octet-stream'): Express.Multer.File {
  return {
    originalname: filename,
    mimetype,
    buffer: Buffer.from(content),
  } as Express.Multer.File;
}
