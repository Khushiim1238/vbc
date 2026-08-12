import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// import { sendWhatsAppNotification } from '@/lib/whatsapp'; // Disabling paid API

export async function POST(request: Request) {
  try {
    const { order_id } = await request.json();

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // 1. Fetch the pending order with karigar details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, karigars(*)')
      .eq('id', order_id)
      .eq('status', 'pending')
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found or already processed' }, { status: 404 });
    }

    const points_awarded = order.points_awarded;
    const karigar = order.karigars;
    const current_points = karigar.total_points || 0;
    const balance_after = current_points + points_awarded;

    // 2. Update order status to approved
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'approved' })
      .eq('id', order_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Insert into points_ledger
    if (points_awarded > 0) {
      const { error: ledgerError } = await supabase
        .from('points_ledger')
        .insert([
          {
            karigar_id: order.karigar_id,
            order_id: order.id,
            points_change: points_awarded,
            balance_after,
          }
        ]);

      if (ledgerError) {
         console.error('Failed to insert ledger entry:', ledgerError);
      }
    }

    // Format coupon string
    const couponCount = points_awarded;
    const startCoupon = order.coupon_number;
    let couponString = startCoupon?.toString() || order.id.slice(0, 6).toUpperCase();
    if (couponCount > 1 && startCoupon) {
      const coupons = [];
      for (let i = 0; i < couponCount; i++) {
        coupons.push(startCoupon + i);
      }
      couponString = coupons.join(", ");
    }

    // 4. Return data for free 1-click WhatsApp popup
    return NextResponse.json({ 
      success: true, 
      order_id,
      whatsapp_data: {
        phone: karigar.phone,
        name: karigar.name,
        bags: order.bags_ordered,
        sariya: order.sariya_ordered,
        pointsAwarded: points_awarded,
        totalPoints: balance_after,
        couponCode: couponString
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
