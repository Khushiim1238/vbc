import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  // Allow both admin and staff
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, phone } = await request.json();
    const { id } = await context.params;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('karigars')
      .update({ name, phone })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A Karigar with this phone number already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, karigar: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update Karigar' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  // Allow both admin and staff
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const { error } = await supabase
      .from('karigars')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete Karigar' }, { status: 500 });
  }
}
