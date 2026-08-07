import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { karigar_id, bags_ordered, entered_by } = await request.json();

    if (!karigar_id || !bags_ordered || !entered_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rule: 1 point for every 100 bags
    const points_awarded = Math.floor(bags_ordered / 100);

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

    // 2. Insert into orders table
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          karigar_id,
          bags_ordered,
          entered_by,
          points_awarded,
        }
      ])
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 3. Insert into points_ledger
    if (points_awarded > 0) {
      const { error: ledgerError } = await supabase
        .from('points_ledger')
        .insert([
          {
            karigar_id,
            order_id: order.id,
            points_change: points_awarded,
            balance_after,
          }
        ]);

      if (ledgerError) {
         // In a robust system, we would rollback the order here or use a DB transaction (RPC).
         console.error('Failed to insert ledger entry:', ledgerError);
      }
    }

    // 4. Send WhatsApp Notification (asynchronously, don't await so the client gets a fast response)
    if (points_awarded > 0) {
      sendWhatsAppNotification({
        phone: karigar.phone,
        name: karigar.name,
        bags: bags_ordered,
        pointsAwarded: points_awarded,
        totalPoints: balance_after,
        orderId: order.id.slice(0, 8).toUpperCase(), // Short ID
        orderTime: order.order_time
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, order, new_total: balance_after });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
