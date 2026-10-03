import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ message: 'MongoDB Connected Successfully!' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to connect to MongoDB', details: String(error) }, { status: 500 });
  }
}