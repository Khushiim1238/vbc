"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Clock, Loader2 } from "lucide-react";

interface PendingOrder {
  id: string;
  karigar_id: string;
  bags_ordered: number;
  sariya_ordered: number;
  order_time: string;
  entered_by: string;
  points_awarded: number;
  karigars?: { name: string; phone: string };
}

export default function AdminPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingOrders();

    // Set up Realtime Subscription for new orders
    const orderSub = supabase
      .channel('admin-orders-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        // We only care about pending orders
        if (payload.new.status === 'pending') {
          // Fetch the joined name and phone for the new order
          const { data: karigarData } = await supabase
            .from('karigars')
            .select('name, phone')
            .eq('id', payload.new.karigar_id)
            .single();
            
          const newOrder = { ...payload.new, karigars: karigarData } as PendingOrder;
          
          setOrders(prev => {
            // Check if it already exists to prevent duplicates
            if (prev.some(o => o.id === newOrder.id)) return prev;
            // Add new order at the top
            return [newOrder, ...prev];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderSub);
    };
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, karigars(name, phone)")
        .eq("status", "pending")
        .order("order_time", { ascending: false });
        
      if (error) throw error;
      setOrders((data as any) || []);
    } catch (err: any) {
      console.error("Failed to fetch pending orders", err);
      setErrorMsg(err?.message || JSON.stringify(err) || "Failed to fetch orders. Did you run the SQL migration?");
    } finally {
      setLoading(false);
    }
  };


  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      const res = await fetch("/api/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Remove from list
        setOrders(prev => prev.filter(o => o.id !== orderId));

        // 1-Click WhatsApp Magic (100% Free)
        if (data.whatsapp_data && data.whatsapp_data.pointsAwarded > 0) {
          const w = data.whatsapp_data;
          
          const orderDetails = [];
          if (w.bags > 0) orderDetails.push(`सीमेंट: ${w.bags} बैग`);
          if (w.sariya > 0) orderDetails.push(`सरिया: ${w.sariya}`);
          const orderDetailsText = orderDetails.join(', ') || 'ऑर्डर';
          
          const msg = `वर्धमान ग्रुप 🙏\n\nनमस्ते ${w.name} जी,\n\nआपका ऑर्डर स्वीकृत हो गया है:\n${orderDetailsText}\n\n🎉 आपको ${w.pointsAwarded} पॉइंट(s) मिले हैं!\n⭐ कुल पॉइंट्स: ${w.totalPoints}\n\nधन्यवाद!`;
          
          let phone = w.phone.replace(/\D/g, '');
          if (phone.length === 10) phone = '91' + phone;
          
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
          window.open(url, '_blank');
        }
      } else {
        alert(data.error || "Failed to approve order");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setProcessingId(null);
    }
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading pending entries...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error loading data! </strong>
            <span className="block sm:inline">{errorMsg}</span>
            <p className="mt-2 text-sm">Did you forget to run the SQL migration command in Supabase?<br/><code>ALTER TABLE public.orders ADD COLUMN status TEXT DEFAULT 'pending';</code></p>
          </div>
        )}
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Approval</h1>
          <p className="text-slate-500 mt-1">
            Review and approve today's entries. Approved entries will instantly award points and send WhatsApp notifications.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Approvals ({orders.length})
          </h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No pending entries to review. You're all caught up!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Karigar</th>
                    <th className="pb-3 font-medium">Purchases</th>
                    <th className="pb-3 font-medium text-right">Points to Award</th>
                    <th className="pb-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="text-sm">
                      <td className="py-4 text-slate-500">
                        {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <div className="text-xs">{new Date(o.order_time).toLocaleDateString()}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-semibold">{o.karigars?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-400">{o.karigars?.phone}</div>
                      </td>
                      <td className="py-4 font-medium text-slate-600">
                        {[
                          o.bags_ordered > 0 ? `${o.bags_ordered} bags` : null,
                          o.sariya_ordered > 0 ? `${o.sariya_ordered} sariya` : null
                        ].filter(Boolean).join(' & ')}
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          +{o.points_awarded}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleApprove(o.id)}
                          disabled={processingId === o.id}
                          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {processingId === o.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </div>
    </main>
  );
}
