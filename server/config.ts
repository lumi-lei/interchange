import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();

export const DISABLED_EXTERNAL_MODEL_PROVIDER = 'none' as const;
export type TextModelProviderName = 'deepseek' | (string & {});
export type ExternalModelProviderName = typeof DISABLED_EXTERNAL_MODEL_PROVIDER | (string & {});

function providerEnv(value: string | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || fallback;
}

export const config = {
  port: Number(process.env.PORT ?? 4120),
  sqlitePath: path.resolve(root, process.env.SQLITE_PATH ?? './data/interchange.sqlite'),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  textModelProvider: (process.env.TEXT_MODEL_PROVIDER ?? 'deepseek') as TextModelProviderName,
  visionModelProvider: providerEnv(process.env.VISION_MODEL_PROVIDER, DISABLED_EXTERNAL_MODEL_PROVIDER) as ExternalModelProviderName,
  fileModelProvider: providerEnv(process.env.FILE_MODEL_PROVIDER, DISABLED_EXTERNAL_MODEL_PROVIDER) as ExternalModelProviderName,
  largeTextLimit: Number(process.env.LARGE_TEXT_LIMIT ?? 30000),
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB ?? 25),
  markitdownCommand: process.env.MARKITDOWN_COMMAND?.trim() || 'markitdown',
  markitdownTimeoutMs: Number(process.env.MARKITDOWN_TIMEOUT_MS ?? 30000),
};

export function requireDeepSeekKey() {
  if (!config.deepseekApiKey) {
    const error = new Error('DEEPSEEK_API_KEY is not configured. Add it to .env before generating AI drafts.');
    Object.assign(error, { status: 503 });
    throw error;
  }
}
