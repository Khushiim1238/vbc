import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { karigar_id, bags_ordered, sariya_ordered, entered_by } = await request.json();

    const bags = Number(bags_ordered) || 0;
    const sariya = Number(sariya_ordered) || 0;

    if (!karigar_id || (bags === 0 && sariya === 0) || !entered_by) {
      return NextResponse.json({ error: 'Missing required fields or both amounts are 0' }, { status: 400 });
    }

    // Rule: 1 point for every 100 bags, 1 point for every 100,000 sariya
    const points_awarded = Math.floor(bags / 100) + Math.floor(sariya / 100000);

    // 1. Fetch the karigar's current details
    const { data: karigar, error: karigarError } = await supabase
      .from('karigars')
      .select('*')
      .eq('id', karigar_id)
      .single();

    if (karigarError || !karigar) {
      return NextResponse.json({ error: 'Karigar not found' }, { status: 404 });
    }

    const current_points = karigar.total_points || 0;
    const balance_after = current_points + points_awarded;

    // 2. Fetch the most recent order to determine the next coupon sequence
    let nextCouponNumber = 10; // Default starting coupon number

    const { data: latestOrder, error: latestOrderError } = await supabase
      .from('orders')
      .select('coupon_number, points_awarded')
      .not('coupon_number', 'is', null)
      .order('order_time', { ascending: false })
      .limit(1)
      .single();

    if (latestOrder && latestOrder.coupon_number) {
      // The next coupon number is the previous starting number + the number of coupons the previous order earned
      nextCouponNumber = latestOrder.coupon_number + latestOrder.points_awarded;
    }

    // 3. Insert into orders table (Default status is 'pending')
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          karigar_id,
          bags_ordered: bags,
          sariya_ordered: sariya,
          entered_by,
          points_awarded,
          coupon_number: nextCouponNumber
        }
      ])
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order, new_total: current_points });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
