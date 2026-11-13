import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pin, portal } = await request.json();
    
    let role = '';

    const adminPin = process.env.ADMIN_PIN || '1971';
    const staffPin = process.env.STAFF_PIN || '8081';

    if (pin === adminPin) {
      role = 'admin';
    } else if (pin === staffPin) {
      role = 'staff';
    } else {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieAge = 60 * 60 * 24; // 24 Hours

    if (portal === 'dukandar') {
      // Dedicated Dukandar cookie (valid for 24 hours, isolated from Karigar)
      cookieStore.set('vbc_dukandar_role', role, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: cookieAge
      });
      if (role === 'admin') {
        cookieStore.set('vbc_role', 'admin', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: cookieAge
        });
      }
    } else {
      // Karigar / General portal cookie (valid for 24 hours)
      cookieStore.set('vbc_role', role, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: cookieAge
      });
    }

    return NextResponse.json({ success: true, role, portal: portal || 'karigar' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
