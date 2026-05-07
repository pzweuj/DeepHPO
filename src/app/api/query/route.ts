import { NextRequest } from 'next/server';
import { queryStream } from '../../components/llm';

export const maxDuration = 60;

const requestCache = new Map<string, any>();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q') || '';

  const apiUrl = req.headers.get('x-api-url') || '';
  const apiKey = req.headers.get('x-api-key') || '';
  const model = req.headers.get('x-model') || '';

  const cacheKey = `${q}-${apiUrl}-${apiKey}-${model}`;

  if (requestCache.has(cacheKey)) {
    return new Response(JSON.stringify(requestCache.get(cacheKey)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stream = queryStream({ question: q, apiUrl, apiKey, model });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
