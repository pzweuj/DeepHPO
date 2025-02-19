import { NextRequest } from 'next/server';
import { searchHPOTerms } from '../../components/greper';
// import { query } from '../../components/deepseek';
import { query } from '../../components/deepseek_tencent_lke';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type') || 'matcher';
  const q = searchParams.get('q') || '';

  try {
    const data = type === 'matcher' 
      ? await query({ question: q })
      : await searchHPOTerms(q);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify([{ error: '查询失败' }]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 