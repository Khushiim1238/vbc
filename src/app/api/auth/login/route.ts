import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    
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
    cookieStore.set('vbc_role', role, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
