import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Keep database active and verify connection
    const userCount = await prisma.user.count();
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      userCount,
      message: 'Supabase keep-alive successful',
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
