import OpenAI from 'openai';
import { config, requireDeepSeekKey } from '../../config.js';
import { buildDraftMessages } from '../prompts.js';
import type { DraftRequest, DraftResponse, TextModelProvider } from '../types.js';

export class DeepSeekProvider implements TextModelProvider {
  async generateDraft(input: DraftRequest): Promise<DraftResponse> {
    requireDeepSeekKey();
    const client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    });

    const completion = await client.chat.completions.create({
      model: config.deepseekModel,
      stream: false,
      messages: buildDraftMessages(input),
    });

    return { content: completion.choices[0]?.message?.content?.trim() ?? '' };
  }
}

export const deepSeekProvider = new DeepSeekProvider();
