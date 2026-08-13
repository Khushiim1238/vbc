import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  
  if (role) {
    return NextResponse.json({ authenticated: true, role });
  }
  
  return NextResponse.json({ authenticated: false, role: null });
}
