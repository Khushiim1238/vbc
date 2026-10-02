import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const role = cookieStore.get('vbc_role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { order_id } = await request.json();

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // 1. Fetch the pending order with dukandar details
    const { data: order, error: orderError } = await supabase
      .from('dukandar_orders')
      .select('*, dukandars(*)')
      .eq('id', order_id)
      .eq('status', 'pending')
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found or already processed' }, { status: 404 });
    }

    const points_awarded = order.points_awarded;
    const dukandar = order.dukandars;
    const current_points = dukandar.total_points || 0;
    const balance_after = current_points + points_awarded;

    // 2. Update order status to approved
    const { error: updateError } = await supabase
      .from('dukandar_orders')
      .update({ status: 'approved' })
      .eq('id', order_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Insert into dukandar_points_ledger
    if (points_awarded > 0) {
      const { error: ledgerError } = await supabase
        .from('dukandar_points_ledger')
        .insert([
          {
            dukandar_id: order.dukandar_id,
            order_id: order.id,
            points_change: points_awarded,
            balance_after,
          }
        ]);

      if (ledgerError) {
        console.error('Failed to insert dukandar ledger entry:', ledgerError);
      }
    }

    // 4. Return data for free 1-click WhatsApp popup
    return NextResponse.json({ 
      success: true, 
      order_id,
      whatsapp_data: {
        phone: dukandar.phone,
        name: dukandar.name,
        bags: order.bags_ordered,
        pointsAwarded: points_awarded,
        totalPoints: balance_after
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
