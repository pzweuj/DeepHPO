import { NextRequest } from 'next/server';
import { searchHPOTerms } from '../../components/greper';
import { query } from '../../components/llm';

export const maxDuration = 60;

// 添加请求缓存，避免重复处理相同的请求
const requestCache = new Map();

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type') || 'matcher';
  const q = searchParams.get('q') || '';

  // 从请求头中获取API设置
  const apiUrl = req.headers.get('x-api-url') || '';
  const apiKey = req.headers.get('x-api-key') || '';
  const model = req.headers.get('x-model') || '';
  
  // 创建缓存键
  const cacheKey = `${type}-${q}-${apiUrl}-${apiKey}-${model}`;
  
  // 检查缓存中是否已有结果
  if (requestCache.has(cacheKey)) {
    return new Response(JSON.stringify(requestCache.get(cacheKey)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = type === 'matcher' 
      ? await query({ 
          question: q,
          apiUrl,
          apiKey,
          model
        })
      : await searchHPOTerms(q);
    
    // 存储结果到缓存
    requestCache.set(cacheKey, data);
    
    // 限制缓存大小
    if (requestCache.size > 100) {
      const oldestKey = requestCache.keys().next().value;
      requestCache.delete(oldestKey);
    }
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : '查询失败';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error details:', errorMessage, errorStack);
    
    return new Response(JSON.stringify([{ 
      hpo: 'HP:0000001',
      name: 'Error',
      chineseName: '搜索错误',
      destination: 'ERROR',
      description: errorMessage,
      confidence: '-',
      remark: '系统错误'
    }]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 
