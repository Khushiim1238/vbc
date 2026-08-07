import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('karigars')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Karigars' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('karigars')
      .insert([{ name, phone, total_points: 0 }])
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation on phone number
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A Karigar with this phone number already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, karigar: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create Karigar' }, { status: 500 });
  }
}
