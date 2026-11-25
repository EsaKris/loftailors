import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
// Public: only which tracked size/colour combinations are sold out. No quantities are exposed.
export const dynamic = 'force-dynamic';
export async function GET() {
  const { data } = await db.from('variant_stock').select('size, colour, stock');
  return NextResponse.json({ soldOut: (data || []).filter((v: any) => v.stock <= 0).map((v: any) => `${v.colour}|${v.size}`) }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } });
}
