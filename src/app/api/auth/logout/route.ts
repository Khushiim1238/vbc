import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');
    const cookieStore = await cookies();

    if (portal === 'dukandar') {
      cookieStore.delete('vbc_dukandar_role');
    } else {
      cookieStore.delete('vbc_role');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
