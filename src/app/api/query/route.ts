import { NextRequest } from 'next/server';
import { query } from '../../components/llm';

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

  try {
    const data = await query({
      question: q,
      apiUrl,
      apiKey,
      model
    });

    requestCache.set(cacheKey, data);
    if (requestCache.size > 100) {
      const oldestKey = requestCache.keys().next().value;
      if (oldestKey) requestCache.delete(oldestKey);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : '查询失败';

    return new Response(JSON.stringify([{
      hpo: 'HP:0000001',
      name: 'Error',
      chineseName: '搜索错误',
      definition: 'ERROR',
      definitionCn: errorMessage,
      confidence: '-',
      remark: '系统错误'
    }]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
