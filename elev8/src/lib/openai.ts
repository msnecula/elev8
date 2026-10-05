import 'server-only';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set — add it to .env.local');
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const OPENAI_MODEL = 'gpt-4o' as const;
