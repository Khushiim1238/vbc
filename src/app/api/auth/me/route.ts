import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const portal = searchParams.get('portal');
  const cookieStore = await cookies();

  if (portal === 'dukandar') {
    const dukandarRole = cookieStore.get('vbc_dukandar_role')?.value;
    if (dukandarRole) {
      return NextResponse.json({ authenticated: true, role: dukandarRole, portal: 'dukandar' });
    }
    return NextResponse.json({ authenticated: false, role: null, portal: 'dukandar' });
  }

  // Default / Karigar / Admin
  const role = cookieStore.get('vbc_role')?.value;
  
  if (role) {
    return NextResponse.json({ authenticated: true, role });
  }
  
  return NextResponse.json({ authenticated: false, role: null });
}
