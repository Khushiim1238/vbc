"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckCircle2, Clock, Package, Trophy } from "lucide-react";
import Link from "next/link";

interface Transaction {
  id: string;
  karigar_id: string;
  bags_ordered: number;
  sariya_ordered: number;
  order_time: string;
  status: string;
  points_awarded: number;
  karigars?: { name: string; phone: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      // Fetch latest 50 transactions
      const { data, error } = await supabase
        .from("orders")
        .select("*, karigars(name, phone)")
        .order("order_time", { ascending: false })
        .limit(50);
        
      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading history...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      
      {/* App Bar */}
      <header className="px-4 py-4 flex items-center bg-white sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-slate-800 ml-2">
          Transaction History
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No transactions found.</div>
          ) : (
            transactions.map((t) => {
              const isApproved = t.status === 'approved';
              const isPending = t.status === 'pending';

              return (
                <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isApproved ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {isApproved ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <Clock className="w-6 h-6 text-amber-600" />
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">
                      {t.karigars?.name || 'Unknown Karigar'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(t.order_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(t.order_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm font-medium text-slate-600 mt-1 truncate">
                      {[
                        t.bags_ordered > 0 ? `${t.bags_ordered} bags` : null,
                        t.sariya_ordered > 0 ? `${t.sariya_ordered} sariya` : null
                      ].filter(Boolean).join(' & ')}
                    </p>
                  </div>

                  {/* Points & Status */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`font-extrabold text-lg ${isApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                        +{t.points_awarded}
                      </span>
                      <Trophy className={`w-4 h-4 ${isApproved ? 'text-emerald-500' : 'text-slate-300'}`} />
                    </div>
                    <div className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {isApproved ? 'Approved' : 'Pending'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
