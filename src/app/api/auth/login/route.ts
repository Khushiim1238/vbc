import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    
    let role = '';

    if (pin === process.env.ADMIN_PIN) {
      role = 'admin';
    } else if (pin === process.env.STAFF_PIN) {
      role = 'staff';
    } else {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('vbc_role', role, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
