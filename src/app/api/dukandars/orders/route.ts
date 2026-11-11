import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get('vbc_role')?.value;
  if (!userRole) {
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
  const callerRole = cookieStore.get('vbc_role')?.value || 'staff';

  try {
    const body = await request.json();
    const { dukandar_id, bags_ordered, sariya_ordered, pole_ordered, tile_ordered, entered_by } = body;

    const bags = Number(bags_ordered) || 0;
    const sariya = Number(sariya_ordered) || 0;
    const pole = Number(pole_ordered) || 0;
    const tile = Number(tile_ordered) || 0;

    if (!dukandar_id) {
      return NextResponse.json({ error: 'Please select a valid Dukandar' }, { status: 400 });
    }

    if (bags <= 0 && sariya <= 0 && pole <= 0 && tile <= 0) {
      return NextResponse.json({ error: 'Please enter quantity or amount for at least one item' }, { status: 400 });
    }

    const staffName = (typeof entered_by === 'string' && entered_by.trim()) ? entered_by.trim() : (callerRole === 'admin' ? 'Admin' : 'Staff');

    // Point Calculation:
    // Cement: 1 bag = 1 point
    // Sariya, Pole, Tile: 1 point per ₹1,000 purchase (each calculated independently)
    const points_awarded =
      bags +
      Math.floor(sariya / 1000) +
      Math.floor(pole / 1000) +
      Math.floor(tile / 1000);

    // 1. Fetch dukandar
    const { data: dukandar, error: dukandarError } = await supabase
      .from('dukandars')
      .select('*')
      .eq('id', dukandar_id)
      .single();

    if (dukandarError || !dukandar) {
      console.error('Dukandar not found error:', dukandarError);
      return NextResponse.json({ error: dukandarError?.message || 'Dukandar record not found' }, { status: 404 });
    }

    // 2. Insert into dukandar_orders
    const { data: order, error: orderError } = await supabase
      .from('dukandar_orders')
      .insert([
        {
          dukandar_id,
          bags_ordered: bags,
          sariya_ordered: sariya,
          pole_ordered: pole,
          tile_ordered: tile,
          entered_by: staffName,
          points_awarded
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error('Dukandar order insert error:', orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        dukandars: dukandar
      },
      new_total: dukandar.total_points || 0
    });
  } catch (error: any) {
    console.error('Unhandled Dukandar Order Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
