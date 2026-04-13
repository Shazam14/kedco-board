import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL!;

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/banks`, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
