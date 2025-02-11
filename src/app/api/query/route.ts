import { NextRequest } from 'next/server';
import { searchHPOTerms } from '../../components/greper';
import { query } from '../../components/deepseek';

export const maxDuration = 60; // 免费账户实际支持60秒超时
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type') || 'matcher';
  const q = searchParams.get('q') || '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 58000); // 58秒主动中止

  try {
    const data = type === 'matcher' 
      ? await query({ 
          question: q,
          signal: controller.signal
        })
      : await searchHPOTerms({ 
          term: q, 
          signal: controller.signal 
        });

    clearTimeout(timeout);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Timeout-Allowance': '60s' // 添加超时标头
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(JSON.stringify({
        error: '请求超时（免费版最长60秒）',
        suggestion: '请尝试拆分复杂问题',
        code: 504
      }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: '服务处理异常',
      code: 500,
      debug: process.env.NODE_ENV === 'development' 
        ? error instanceof Error 
          ? error.message 
          : String(error)
        : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 