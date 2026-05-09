import { NextRequest } from 'next/server';
import { searchHPOTerms } from '../../components/greper';
import { queryTwoRoundStream } from '@/lib/llmTwoRound';
import logger from '@/lib/logger';

export const maxDuration = 60;

const requestCache = new Map<string, any>();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type') || 'matcher';
  const q = searchParams.get('q') || '';

  const apiUrl = req.headers.get('x-api-url') || '';
  const apiKey = req.headers.get('x-api-key') || '';
  const model = req.headers.get('x-model') || '';

  const cacheKey = `${type}-${q}-${apiUrl}-${apiKey}-${model}`;

  // 表型匹配模式：直接返回JSON结果
  if (type === 'searcher') {
    if (requestCache.has(cacheKey)) {
      return new Response(JSON.stringify(requestCache.get(cacheKey)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const data = await searchHPOTerms(q);
      requestCache.set(cacheKey, data);

      if (requestCache.size > 100) {
        const oldestKey = requestCache.keys().next().value;
        if (oldestKey) {
          requestCache.delete(oldestKey);
        }
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      logger.error('Search error:', error);
      return new Response(JSON.stringify([{
        hpo: 'HP:0000001',
        name: 'Error',
        chineseName: '搜索错误',
        definition: 'ERROR',
        definitionCn: error instanceof Error ? error.message : '搜索失败',
        confidence: '-',
        remark: '系统错误'
      }]), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // LLM模式：两轮查询流式响应
  if (requestCache.has(cacheKey)) {
    return new Response(JSON.stringify(requestCache.get(cacheKey)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stream = queryTwoRoundStream({ question: q, apiUrl, apiKey, model });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
