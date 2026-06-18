import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const defaultModel =
    process.env.NEXT_PUBLIC_MODEL ||
    process.env.MODEL ||
    '';

  return NextResponse.json({ defaultModel });
}
