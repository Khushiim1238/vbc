"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Trophy, Package, Users } from "lucide-react";

interface Karigar {
  id: string;
  name: string;
  phone: string;
  total_points: number;
}

interface Order {
  id: string;
  karigar_id: string;
  bags_ordered: number;
  order_time: string;
  entered_by: string;
  points_awarded: number;
  karigars?: { name: string }; // Joined
}

export default function Dashboard() {
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      const [karigarsRes, ordersRes] = await Promise.all([
        supabase.from("karigars").select("*").order("total_points", { ascending: false }),
        supabase.from("orders").select("*, karigars(name)").order("order_time", { ascending: false }).limit(20)
      ]);

      if (karigarsRes.data) setKarigars(karigarsRes.data);
      if (ordersRes.data) setOrders(ordersRes.data as any);
      setLoading(false);
    };

    fetchData();

    // Set up Realtime Subscriptions
    const karigarSub = supabase
      .channel('karigars-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'karigars' }, payload => {
        setKarigars(prev => {
          const updated = [...prev];
          const index = updated.findIndex(k => k.id === payload.new.id);
          if (index !== -1) updated[index] = payload.new as Karigar;
          return updated.sort((a, b) => b.total_points - a.total_points);
        });
      })
      .subscribe();

    const orderSub = supabase
      .channel('orders-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async payload => {
        // Fetch the joined name for the new order
        const { data } = await supabase.from('karigars').select('name').eq('id', payload.new.karigar_id).single();
        const newOrder = { ...payload.new, karigars: data } as Order;
        
        setOrders(prev => [newOrder, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(karigarSub);
      supabase.removeChannel(orderSub);
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 dark:text-white">Loading...</div>;
  }

  const totalPointsGiven = karigars.reduce((acc, k) => acc + k.total_points, 0);
  const totalBagsOrdered = orders.reduce((acc, o) => acc + o.bags_ordered, 0);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vardhaman Group Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Live Updates Active
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Karigars" value={karigars.length} icon={Users} color="text-blue-500" />
          <StatCard title="Points Distributed" value={totalPointsGiven} icon={Trophy} color="text-amber-500" />
          <StatCard title="Recent Bags (Last 20)" value={totalBagsOrdered} icon={Package} color="text-emerald-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Leaderboard */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Karigar Leaderboard
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                    <th className="pb-3 font-medium">Rank</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Phone</th>
                    <th className="pb-3 font-medium text-right">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {karigars.map((k, i) => (
                    <tr key={k.id} className="text-sm">
                      <td className="py-4 font-medium text-slate-400">#{i + 1}</td>
                      <td className="py-4 font-semibold">{k.name}</td>
                      <td className="py-4 text-slate-500 dark:text-slate-400">{k.phone}</td>
                      <td className="py-4 text-right font-bold text-amber-500">{k.total_points} ⭐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 h-[600px] flex flex-col">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-500" />
              Live Activity
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold">{o.karigars?.name || 'Unknown'}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Ordered <span className="font-medium text-slate-900 dark:text-white">{o.bags_ordered} bags</span>
                  </p>
                  {o.points_awarded > 0 && (
                    <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 inline-block px-2 py-1 rounded-md">
                      +{o.points_awarded} Points Awarded
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
      <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 ${color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
    </div>
  );
}
