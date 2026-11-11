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
    const current_points = dukandar?.total_points || 0;
    const balance_after = current_points + points_awarded;

    // 2. Fetch atomic coupon sequence for Dukandar if sequence exists
    let assignedCouponNumber: number | null = null;
    if (points_awarded > 0) {
      try {
        const { data: nextCoupon, error: seqError } = await supabase.rpc('get_next_dukandar_coupon');
        if (!seqError && typeof nextCoupon === 'number') {
          assignedCouponNumber = nextCoupon;
        }
      } catch {
        // Safe fallback if sequence is not yet created
      }
    }

    // 3. Update order status to approved (with coupon_number if supported)
    const updatePayload: Record<string, any> = { status: 'approved' };
    if (assignedCouponNumber !== null) {
      updatePayload.coupon_number = assignedCouponNumber;
    }

    let { error: updateError } = await supabase
      .from('dukandar_orders')
      .update(updatePayload)
      .eq('id', order_id);

    // Fallback if coupon_number column is not present in Supabase table yet
    if (updateError && (updateError.message?.includes('coupon_number') || updateError.code === 'PGRST204')) {
      const fallbackResult = await supabase
        .from('dukandar_orders')
        .update({ status: 'approved' })
        .eq('id', order_id);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Insert into dukandar_points_ledger
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

    // 5. Return data for free 1-click WhatsApp popup
    return NextResponse.json({ 
      success: true, 
      order_id,
      whatsapp_data: {
        phone: dukandar?.phone,
        name: dukandar?.name,
        bags: order.bags_ordered,
        sariya: order.sariya_ordered || 0,
        pole: order.pole_ordered || 0,
        tile: order.tile_ordered || 0,
        pointsAwarded: points_awarded,
        totalPoints: balance_after,
        couponNumber: assignedCouponNumber
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

