"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Clock, Loader2, XCircle, CheckSquare, Activity, Trophy, Package, Users, LayoutDashboard, ListChecks, Lock, Search, ChevronRight } from "lucide-react";

interface PendingOrder {
  id: string;
  karigar_id: string;
  bags_ordered: number;
  sariya_ordered: number;
  order_time: string;
  entered_by: string;
  points_awarded: number;
  coupon_number: number;
  karigars?: { name: string; phone: string };
}

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
  sariya_ordered: number;
  order_time: string;
  status: string;
  points_awarded: number;
  coupon_number: number;
  karigars?: { name: string; phone: string };
}

// Utility to format coupon numbers
const formatCoupons = (start: number | null | undefined, count: number) => {
  if (!start) return count.toString();
  if (count === 1) return start.toString();
  const arr = [];
  for(let i=0; i<count; i++) arr.push(start + i);
  return arr.join(", ");
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [activeTab, setActiveTab] = useState<'approvals' | 'dashboard' | 'directory'>('approvals');

  // --- Admin Approvals State ---
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancelProcessingId, setCancelProcessingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // --- Dashboard State ---
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([]);
  
  // --- Directory State ---
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedKarigarDetails, setSelectedKarigarDetails] = useState<Karigar | null>(null);
  const [karigarHistory, setKarigarHistory] = useState<Order[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [bulkApprovedOrders, setBulkApprovedOrders] = useState<any[]>([]);
  const karigarsRef = useRef<Karigar[]>([]);

  useEffect(() => {
    karigarsRef.current = karigars;
  }, [karigars]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.role === 'admin') {
          setIsAuthenticated(true);
          fetchData();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed", err);
      }
    };
    checkAuth();

    // Setup Subscriptions
    const adminOrderSub = supabase
      .channel('admin-orders-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.new.status === 'pending') {
          const k = karigarsRef.current.find(k => k.id === payload.new.karigar_id);
          const karigarData = k ? { name: k.name, phone: k.phone } : undefined;
          const newOrder = { ...payload.new, karigars: karigarData } as PendingOrder;
          setPendingOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            return [...prev, newOrder];
          });
        }
      })
      .subscribe();

    const dashKarigarSub = supabase
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

    const dashOrderSub = supabase
      .channel('dash-orders-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const k = karigarsRef.current.find(k => k.id === payload.new.karigar_id);
        const karigarData = k ? { name: k.name } : undefined;
        const newOrder = { ...payload.new, karigars: karigarData } as Order;
        setDashboardOrders(prev => [newOrder, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(adminOrderSub);
      supabase.removeChannel(dashKarigarSub);
      supabase.removeChannel(dashOrderSub);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [pendingRes, karigarsRes, ordersRes] = await Promise.all([
        supabase.from("orders").select("*, karigars(name, phone)").eq("status", "pending").order("order_time", { ascending: true }),
        supabase.from("karigars").select("*").order("total_points", { ascending: false }),
        supabase.from("orders").select("*, karigars(name)").order("order_time", { ascending: false }).limit(200)
      ]);

      if (pendingRes.error) throw pendingRes.error;
      
      setPendingOrders((pendingRes.data as PendingOrder[]) || []);
      if (karigarsRes.data) setKarigars(karigarsRes.data as Karigar[]);
      if (ordersRes.data) setDashboardOrders(ordersRes.data as Order[]);
      
    } catch (err: unknown) {
      console.error("Failed to fetch data", err);
      setAdminError(err instanceof Error ? err.message : "Failed to fetch data.");
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
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        setSelectedOrderIds(prev => prev.filter(id => id !== orderId));

        if (data.whatsapp_data && data.whatsapp_data.pointsAwarded > 0) {
          const w = data.whatsapp_data;
          
          let orderDetails = "";
          if (w.bags > 0 && w.sariya > 0) {
            orderDetails = `सीमेंट: ${w.bags} बैग\nसरिया: ₹${w.sariya}`;
          } else if (w.bags > 0) {
            orderDetails = `सीमेंट: ${w.bags} बैग`;
          } else if (w.sariya > 0) {
            orderDetails = `सरिया: ₹${w.sariya}`;
          }

          const msg = `नमस्ते ${w.name} जी 🙏\n\nआपका ऑर्डर स्वीकृत हो गया है:\n${orderDetails}\n\n🎉 हार्दिक बधाई एवं शुभकामनाएं,\n\nआपको मिले हैं कूपन नंबर : ${w.couponCode}\nआपके अब तक कुल कूपन हैं : ${w.totalPoints}\n\nधन्यवाद! वर्धमान ग्रुप टोंक`;
          
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

  const handleCancel = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    
    setCancelProcessingId(orderId);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      
      const data = await res.json();
      if (data.success) {
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      } else {
        alert(data.error || "Failed to cancel order");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setCancelProcessingId(null);
    }
  };

  const fetchKarigarHistory = async (karigarId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('karigar_id', karigarId)
        .eq('status', 'approved')
        .order('order_time', { ascending: false });
        
      if (error) throw error;
      setKarigarHistory((data as Order[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleKarigarClick = (k: Karigar) => {
    setSelectedKarigarDetails(k);
    fetchKarigarHistory(k.id);
  };

  const handleBulkApprove = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!window.confirm(`Approve ${selectedOrderIds.length} selected orders?`)) return;

    setIsBulkProcessing(true);
    const successData = [];

    for (const orderId of selectedOrderIds) {
      try {
        const res = await fetch("/api/orders/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        
        const data = await res.json();
        if (data.success) {
          setPendingOrders(prev => prev.filter(o => o.id !== orderId));
          if (data.whatsapp_data) {
            successData.push(data.whatsapp_data);
          }
        }
      } catch (err) {
        console.error("Bulk approve failed for order", orderId, err);
      }
    }
    
    setSelectedOrderIds([]);
    setIsBulkProcessing(false);
    
    if (successData.length > 0) {
      setBulkApprovedOrders(successData);
    } else {
      alert("Bulk approval complete.");
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === pendingOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(pendingOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(orderId => orderId !== id) : [...prev, id]
    );
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading data...</div>;
  }

  const totalPointsGiven = karigars.reduce((acc, k) => acc + k.total_points, 0);
  const totalBagsOrdered = dashboardOrders.reduce((acc, o) => acc + o.bags_ordered, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Admin Access</h2>
          <p className="text-slate-500 mb-8">Please enter the Admin PIN</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: passwordInput })
              });
              const data = await res.json();
              if (res.ok && data.role === 'admin') {
                setIsAuthenticated(true);
                fetchData(); // Fetch data after successful login
              } else {
                alert(data.error || "Incorrect PIN or Unauthorized");
                setPasswordInput("");
              }
            } catch (err) {
              alert("Network error");
            }
          }}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-slate-50 border border-transparent rounded-2xl mb-6 focus:outline-none focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all font-mono"
              placeholder="••••"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-medium transition-all shadow-lg shadow-slate-800/20 active:scale-95"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {adminError && activeTab === 'approvals' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error loading data! </strong>
            <span className="block sm:inline">{adminError}</span>
          </div>
        )}
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-slate-500 mt-1">Manage orders, approve points, and view performance.</p>
        </div>

        {/* Custom Tab Switcher */}
        <div className="flex p-1 bg-slate-200/60 rounded-xl w-full max-w-sm mb-6">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'approvals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <ListChecks className="w-4 h-4" />
            Pending Approvals {pendingOrders.length > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pendingOrders.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Search className="w-4 h-4" />
            Directory
          </button>
        </div>

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Approvals ({pendingOrders.length})
              </h2>

              {selectedOrderIds.length > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                    {selectedOrderIds.length} Selected
                  </span>
                  <button
                    onClick={handleBulkApprove}
                    disabled={isBulkProcessing}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
                  >
                    {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                    Bulk Approve
                  </button>
                </div>
              )}
            </div>
            
            {pendingOrders.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">You're all caught up!</h3>
                <p className="text-slate-500 mt-1">No pending entries to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-sm text-slate-500 bg-slate-50/50">
                        <th className="pb-3 pt-3 pl-4 w-12 rounded-tl-xl">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            checked={pendingOrders.length > 0 && selectedOrderIds.length === pendingOrders.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="pb-3 pt-3 font-medium">Time</th>
                        <th className="pb-3 pt-3 font-medium">Karigar</th>
                        <th className="pb-3 pt-3 font-medium">Purchases</th>
                        <th className="pb-3 pt-3 font-medium text-right">Points to Award</th>
                        <th className="pb-3 pt-3 font-medium text-right pr-4 rounded-tr-xl">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pendingOrders.map((o) => {
                        const isSelected = selectedOrderIds.includes(o.id);
                        return (
                          <tr key={o.id} className={`text-sm transition-colors ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                            <td className="py-4 pl-4">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelectOrder(o.id)}
                              />
                            </td>
                            <td className="py-4 text-slate-500">
                              {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <div className="text-xs">{new Date(o.order_time).toLocaleDateString()}</div>
                            </td>
                            <td className="py-4">
                              <div className="font-medium text-slate-900">{o.karigars?.name || 'Unknown'}</div>
                              <div className="text-xs text-slate-400">{o.karigars?.phone}</div>
                            </td>
                            <td className="py-4 text-slate-600">
                              {[
                                o.bags_ordered > 0 ? `${o.bags_ordered} bags` : null,
                                o.sariya_ordered > 0 ? `₹${o.sariya_ordered} sariya` : null
                              ].filter(Boolean).join(' & ')}
                            </td>
                            <td className="py-4 text-right">
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-xs">
                                C-No: {formatCoupons(o.coupon_number, o.points_awarded)}
                              </span>
                            </td>
                            <td className="py-4 pr-4 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleCancel(o.id)}
                                disabled={cancelProcessingId === o.id || processingId === o.id || isBulkProcessing}
                                className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                              >
                                {cancelProcessingId === o.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4" />
                                    <span className="hidden xl:inline">Cancel</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleApprove(o.id)}
                                disabled={processingId === o.id || cancelProcessingId === o.id || isBulkProcessing}
                                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                              >
                                {processingId === o.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="hidden xl:inline">Approve</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden flex flex-col gap-4">
                  {/* Select All Row for Mobile */}
                  {pendingOrders.length > 0 && (
                    <div className="flex items-center gap-3 px-2 py-1">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        checked={selectedOrderIds.length === pendingOrders.length}
                        onChange={toggleSelectAll}
                        id="selectAllMobile"
                      />
                      <label htmlFor="selectAllMobile" className="text-sm font-medium text-slate-700 select-none">
                        Select All {pendingOrders.length} Orders
                      </label>
                    </div>
                  )}

                  {pendingOrders.map((o) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <div key={o.id} className={`p-4 rounded-2xl border transition-colors ${isSelected ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-100'} shadow-sm flex flex-col gap-4`}>
                        <div className="flex items-start gap-3">
                          <div className="pt-1 shrink-0">
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleSelectOrder(o.id)}
                            />
                          </div>
                          <div className="flex-1 flex justify-between items-start min-w-0">
                            <div className="min-w-0 pr-2">
                              <h3 className="font-semibold text-slate-900 truncate">{o.karigars?.name || 'Unknown'}</h3>
                              <p className="text-xs text-slate-500">{o.karigars?.phone}</p>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(o.order_time).toLocaleDateString()} {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="font-bold text-emerald-600 bg-emerald-100/50 px-2.5 py-1 rounded-md text-xs whitespace-nowrap">
                                C-No: {formatCoupons(o.coupon_number, o.points_awarded)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-sm font-medium text-slate-700">
                          {[
                            o.bags_ordered > 0 ? `${o.bags_ordered} bags` : null,
                            o.sariya_ordered > 0 ? `₹${o.sariya_ordered} sariya` : null
                          ].filter(Boolean).join(' & ')}
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => handleCancel(o.id)}
                            disabled={cancelProcessingId === o.id || processingId === o.id || isBulkProcessing}
                            className="flex-1 inline-flex justify-center items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                          >
                            {cancelProcessingId === o.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                Cancel
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleApprove(o.id)}
                            disabled={processingId === o.id || cancelProcessingId === o.id || isBulkProcessing}
                            className="flex-1 inline-flex justify-center items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50"
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Karigars" value={karigars.length} icon={Users} color="text-blue-500 bg-blue-50" action={() => setActiveTab('directory')} actionText="View Directory" />
              <StatCard title="Points Distributed" value={totalPointsGiven} icon={Trophy} color="text-amber-500 bg-amber-50" />
              <StatCard title="Recent Bags (Last 200)" value={totalBagsOrdered} icon={Package} color="text-emerald-500 bg-emerald-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Leaderboard */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Karigar Leaderboard
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-sm text-slate-500 bg-slate-50/50">
                        <th className="pb-3 pt-3 pl-4 font-medium rounded-tl-xl">Rank</th>
                        <th className="pb-3 pt-3 font-medium">Name</th>
                        <th className="pb-3 pt-3 font-medium">Phone</th>
                        <th className="pb-3 pt-3 font-medium text-right pr-4 rounded-tr-xl">Total Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {karigars.map((k, i) => (
                        <tr key={k.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pl-4 font-medium text-slate-400">#{i + 1}</td>
                          <td className="py-4 font-medium text-slate-900">{k.name}</td>
                          <td className="py-4 text-slate-500">{k.phone}</td>
                          <td className="py-4 pr-4 text-right font-semibold text-amber-500">{k.total_points} ⭐</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 h-[600px] flex flex-col">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-sky-500" />
                  Live Activity
                </h2>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                  {dashboardOrders.map((o) => (
                    <div key={o.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-slate-900">{o.karigars?.name || 'Unknown'}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Ordered <span className="font-medium text-slate-900">
                          {[
                            o.bags_ordered ? `${o.bags_ordered} bags` : null,
                            o.sariya_ordered ? `₹${o.sariya_ordered} sariya` : null
                          ].filter(Boolean).join(' & ')}
                        </span>
                      </p>
                      {o.points_awarded > 0 && (
                        <div className="mt-2 text-xs font-medium text-emerald-600 bg-emerald-100/50 inline-block px-2 py-1 rounded-md">
                          C-No: {formatCoupons(o.coupon_number, o.points_awarded)} Allotted
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Directory Tab */}
        {activeTab === 'directory' && (
          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Customer Directory
              </h2>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name or phone..." 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {karigars.filter(k => k.name.toLowerCase().includes(directorySearch.toLowerCase()) || k.phone.includes(directorySearch)).map((k) => (
                <div key={k.id} onClick={() => handleKarigarClick(k)} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 cursor-pointer transition-all flex justify-between items-start group">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{k.name}</h3>
                    <p className="text-sm text-slate-500">{k.phone}</p>
                  </div>
                  <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold text-sm">
                    {k.total_points} ⭐
                  </div>
                </div>
              ))}
              
              {karigars.filter(k => k.name.toLowerCase().includes(directorySearch.toLowerCase()) || k.phone.includes(directorySearch)).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500">
                  No customers found matching your search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Karigar Details Modal */}
        {selectedKarigarDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedKarigarDetails(null)}>
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedKarigarDetails.name}</h2>
                  <p className="text-sm text-slate-500">{selectedKarigarDetails.phone} • Total Coupons: {selectedKarigarDetails.total_points}</p>
                </div>
                <button onClick={() => setSelectedKarigarDetails(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                {loadingHistory ? (
                  <div className="flex justify-center items-center py-12 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : karigarHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100">
                    No approved orders with coupons yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {karigarHistory.map(o => (
                      <div key={o.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors">
                        <div>
                          <div className="text-sm text-slate-500 mb-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {new Date(o.order_time).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                          <div className="font-medium text-slate-700 bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">
                            {[
                              o.bags_ordered ? `${o.bags_ordered} bags` : null,
                              o.sariya_ordered ? `₹${o.sariya_ordered} sariya` : null
                            ].filter(Boolean).join(' & ')}
                          </div>
                        </div>
                        {o.points_awarded > 0 && (
                          <div className="shrink-0 text-left sm:text-right">
                            <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold tracking-wider">Coupons Allotted</p>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 inline-block shadow-sm">
                              #{formatCoupons(o.coupon_number, o.points_awarded)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Bulk Approve WhatsApp Modal */}
        {bulkApprovedOrders.length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Orders Approved</h2>
                  <p className="text-sm text-slate-500 mt-1">Send WhatsApp notifications manually.</p>
                </div>
                <button onClick={() => setBulkApprovedOrders([])} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {bulkApprovedOrders.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-medium text-slate-900">{w.name}</p>
                      <p className="text-xs text-slate-500">{w.phone}</p>
                    </div>
                    <button
                      onClick={() => {
                        let orderDetails = "";
                        if (w.bags > 0 && w.sariya > 0) orderDetails = `सीमेंट: ${w.bags} बैग\nसरिया: ₹${w.sariya}`;
                        else if (w.bags > 0) orderDetails = `सीमेंट: ${w.bags} बैग`;
                        else if (w.sariya > 0) orderDetails = `सरिया: ₹${w.sariya}`;

                        let couponMsg = "";
                        if (w.pointsAwarded > 0) {
                          couponMsg = `🎉 हार्दिक बधाई एवं शुभकामनाएं,\n\nआपको मिले हैं कूपन नंबर : ${w.couponCode}\nआपके अब तक कुल कूपन हैं : ${w.totalPoints}\n\n`;
                        } else {
                          couponMsg = `No coupon allotted\nआपके अब तक कुल कूपन हैं : ${w.totalPoints}\n\n`;
                        }

                        const msg = `नमस्ते ${w.name} जी 🙏\n\nआपका ऑर्डर स्वीकृत हो गया है:\n${orderDetails}\n\n${couponMsg}धन्यवाद! वर्धमान ग्रुप टोंक`;
                        let phone = w.phone.replace(/\D/g, '');
                        if (phone.length === 10) phone = '91' + phone;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Send Msg
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={() => setBulkApprovedOrders([])} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors">Done</button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </main>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: any;
  color: string;
  action?: () => void;
  actionText?: string;
}

function StatCard({ title, value, icon: Icon, color, action, actionText }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-2xl ${color}`}>
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold mt-1 text-slate-900">{value}</p>
        </div>
      </div>
      {action && actionText && (
        <button onClick={action} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex flex-col items-center gap-1 shrink-0">
           <ChevronRight className="w-5 h-5" />
           <span className="text-[10px] font-medium uppercase tracking-wider">{actionText}</span>
        </button>
      )}
    </div>
  );
}
