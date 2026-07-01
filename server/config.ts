import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();

export const config = {
  port: Number(process.env.PORT ?? 4120),
  sqlitePath: path.resolve(root, process.env.SQLITE_PATH ?? './data/interchange.sqlite'),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  textModelProvider: process.env.TEXT_MODEL_PROVIDER ?? 'deepseek',
  visionModelProvider: process.env.VISION_MODEL_PROVIDER ?? 'none',
  fileModelProvider: process.env.FILE_MODEL_PROVIDER ?? 'none',
  largeTextLimit: Number(process.env.LARGE_TEXT_LIMIT ?? 30000),
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB ?? 25),
};

export function requireDeepSeekKey() {
  if (!config.deepseekApiKey) {
    const error = new Error('DEEPSEEK_API_KEY is not configured. Add it to .env before generating AI drafts.');
    Object.assign(error, { status: 503 });
    throw error;
  }
}
