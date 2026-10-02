import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('dukandar_orders')
      .select('*, dukandars(*)')
      .order('order_time', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Dukandar orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { dukandar_id, bags_ordered, entered_by } = await request.json();

    const bags = Number(bags_ordered) || 0;

    if (!dukandar_id || bags <= 0 || !entered_by) {
      return NextResponse.json({ error: 'Missing required fields or bags amount is 0' }, { status: 400 });
    }

    // Rule: 1 bag = 1 point
    const points_awarded = bags;

    // 1. Fetch dukandar
    const { data: dukandar, error: dukandarError } = await supabase
      .from('dukandars')
      .select('*')
      .eq('id', dukandar_id)
      .single();

    if (dukandarError || !dukandar) {
      return NextResponse.json({ error: 'Dukandar not found' }, { status: 404 });
    }

    // 2. Insert into dukandar_orders (Default status is 'pending')
    const { data: order, error: orderError } = await supabase
      .from('dukandar_orders')
      .insert([
        {
          dukandar_id,
          bags_ordered: bags,
          entered_by,
          points_awarded
        }
      ])
      .select('*, dukandars(*)')
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      order, 
      new_total: dukandar.total_points || 0 
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
