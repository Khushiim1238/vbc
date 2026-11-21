import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const userRole = cookieStore.get('vbc_dukandar_role')?.value || cookieStore.get('vbc_role')?.value;
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
  const callerRole = cookieStore.get('vbc_dukandar_role')?.value || cookieStore.get('vbc_role')?.value || 'staff';

  try {
    const body = await request.json();
    const { dukandar_id, bags_ordered, sariya_ordered, pole_ordered, cover_block_ordered, binding_wire_ordered, tile_ordered, entered_by } = body;

    const bags = Number(bags_ordered) || 0;
    const sariya = Number(sariya_ordered) || 0;
    const pole = Number(pole_ordered) || 0;
    const cover_block = Number(cover_block_ordered) || 0;
    const binding_wire = Number(binding_wire_ordered) || 0;
    const tile = Number(tile_ordered) || 0;

    if (!dukandar_id) {
      return NextResponse.json({ error: 'Please select a valid Dukandar' }, { status: 400 });
    }

    if (bags <= 0 && sariya <= 0 && pole <= 0 && cover_block <= 0 && binding_wire <= 0 && tile <= 0) {
      return NextResponse.json({ error: 'Please enter quantity or amount for at least one item' }, { status: 400 });
    }

    const staffName = (typeof entered_by === 'string' && entered_by.trim()) ? entered_by.trim() : (callerRole === 'admin' ? 'Admin' : 'Staff');

    // Point Calculation:
    // Cement: 1 bag = 1 point
    // Sariya: 1 point per ₹1,000 purchase
    // Pole: 1 point for 1 pole (1 pole = 1 point)
    // Cover Block: 1 point per ₹400 purchase
    // Binding Wire: 1 point per ₹400 purchase
    // Others (Tile, Cement Block): 1 point for ₹100 purchase
    const points_awarded =
      bags +
      Math.floor(sariya / 1000) +
      pole +
      Math.floor(cover_block / 400) +
      Math.floor(binding_wire / 400) +
      Math.floor(tile / 100);

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
    const insertPayload: Record<string, any> = {
      dukandar_id,
      bags_ordered: bags,
      sariya_ordered: sariya,
      pole_ordered: pole,
      cover_block_ordered: cover_block,
      binding_wire_ordered: binding_wire,
      tile_ordered: tile,
      entered_by: staffName,
      points_awarded
    };

    let { data: order, error: orderError } = await supabase
      .from('dukandar_orders')
      .insert([insertPayload])
      .select()
      .single();

    // Fallback if cover_block_ordered or binding_wire_ordered columns are not yet created in Supabase
    if (orderError && (orderError.message?.includes('cover_block_ordered') || orderError.message?.includes('binding_wire_ordered') || orderError.code === 'PGRST204')) {
      const fallbackPayload = {
        dukandar_id,
        bags_ordered: bags,
        sariya_ordered: sariya,
        pole_ordered: pole,
        tile_ordered: tile,
        entered_by: staffName,
        points_awarded
      };
      const fallbackRes = await supabase
        .from('dukandar_orders')
        .insert([fallbackPayload])
        .select()
        .single();
      order = fallbackRes.data;
      orderError = fallbackRes.error;
    }

    if (orderError) {
      console.error('Dukandar order insert error:', orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    const updatedTotal = (dukandar.total_points || 0) + points_awarded;

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        dukandars: dukandar
      },
      new_total: updatedTotal
    });
  } catch (error: any) {
    console.error('Unhandled Dukandar Order Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
