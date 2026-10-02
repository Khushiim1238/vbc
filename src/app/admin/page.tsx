"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Clock, Loader2, XCircle, CheckSquare, Activity, Trophy, Package, Users, LayoutDashboard, ListChecks, Lock, Search, ChevronRight, Download, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import DukandarAdmin from "@/components/DukandarAdmin";

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
  entered_by: string;
  points_awarded: number;
  coupon_number: number;
  karigars?: { name: string; phone: string };
}

// Utility to format coupon numbers
const formatCoupons = (start: number | null | undefined, count: number) => {
  if (!start) return count.toString();
  if (count === 1) return start.toString();
  if (count > 3) return `${start} to ${start + count - 1}`;
  const arr = [];
  for(let i=0; i<count; i++) arr.push(start + i);
  return arr.join(", ");
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [entityMode, setEntityMode] = useState<'karigar' | 'dukandar'>('karigar');
  const [dukandarPendingCount, setDukandarPendingCount] = useState(0);
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
  
  const [editingKarigarId, setEditingKarigarId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  
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
      
      try {
        const { count } = await supabase
          .from("dukandar_orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        setDukandarPendingCount(count || 0);
      } catch (e) {
        // Safe fallback
      }
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

        if (data.whatsapp_data) {
          const w = data.whatsapp_data;
          
          let orderDetails = "";
          if (w.bags > 0 && w.sariya > 0) {
            orderDetails = `सीमेंट: ${w.bags} बैग, सरिया: ₹${w.sariya}`;
          } else if (w.bags > 0) {
            orderDetails = `सीमेंट: ${w.bags} बैग`;
          } else if (w.sariya > 0) {
            orderDetails = `सरिया: ₹${w.sariya}`;
          }

          let msg = `नमस्ते ${w.name} जी! 🙏\n\n`;
          if (orderDetails) {
            msg += `✅ *ऑर्डर स्वीकृत:* ${orderDetails}\n`;
          }
          if (w.bags > 0) {
            msg += `परफैक्ट प्लस सीमेंट को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n`;
          } else {
            msg += `\n`;
          }

          if (w.pointsAwarded > 0) {
            msg += `🎟️ आपको मिले है कूपन नं: *${w.couponCode}*\n🏆 आपके अब तक कुल कूपन: *${w.totalPoints}*\n\n"ख़ुशियों की बरसात" योजना अवधि (*1 जुलाई 2026* से *30 अगस्त 2027*) में, मोटरसाइकिल, फ्रिज, वाशिंग मशीन, जैसे कई आकर्षक उपहार जीतने के लिए अपने कूपन बढ़ाते रहें!\n\n`;
          } else {
            msg += `🏆 आपके अब तक कुल कूपन: *${w.totalPoints}*\n\n`;
          }

          msg += `हार्दिक बधाई व शुभकामनाएं\n— वर्धमान ग्रुप, टोंक`;
          
          let phone = w.phone.replace(/\D/g, '');
          if (phone.length === 10) phone = '91' + phone;
          
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
          window.open(url, '_blank');
        }
        toast.success("Order approved successfully");
      } else {
        toast.error(data.error || "Failed to approve order");
      }
    } catch (err) {
      toast.error("Something went wrong");
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
        toast.success("Order cancelled");
      } else {
        toast.error(data.error || "Failed to cancel order");
      }
    } catch (err) {
      toast.error("Something went wrong");
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

  const handleEditKarigar = (k: Karigar) => {
    setEditingKarigarId(k.id);
    setEditName(k.name);
    setEditPhone(k.phone);
  };

  const handleSaveKarigar = async (id: string) => {
    try {
      const res = await fetch(`/api/karigars/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setKarigars(prev => prev.map(k => k.id === id ? { ...k, name: editName, phone: editPhone } : k));
        if (selectedKarigarDetails?.id === id) {
          setSelectedKarigarDetails({ ...selectedKarigarDetails, name: editName, phone: editPhone });
        }
        setEditingKarigarId(null);
        toast.success("Karigar updated");
      } else {
        toast.error(data.error || "Failed to update Karigar");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  const handleDeleteKarigar = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Karigar? All their orders and points will also be deleted.")) return;
    try {
      const res = await fetch(`/api/karigars/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setKarigars(prev => prev.filter(k => k.id !== id));
        setSelectedKarigarDetails(null);
        toast.success("Karigar deleted");
      } else {
        toast.error(data.error || "Failed to delete Karigar");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  const handleResendWhatsApp = (order: Order, karigar: Karigar) => {
    let orderDetails = "";
    if (order.bags_ordered > 0 && order.sariya_ordered > 0) orderDetails = `सीमेंट: ${order.bags_ordered} बैग\nसरिया: ₹${order.sariya_ordered}`;
    else if (order.bags_ordered > 0) orderDetails = `सीमेंट: ${order.bags_ordered} बैग`;
    else if (order.sariya_ordered > 0) orderDetails = `सरिया: ₹${order.sariya_ordered}`;

    let msg = `नमस्ते ${karigar.name} जी! 🙏\n\n`;
    if (orderDetails) {
      msg += `✅ *ऑर्डर स्वीकृत:* ${orderDetails.replace('\n', ', ')}\n`;
    }
    if (order.bags_ordered > 0) {
      msg += `परफैक्ट प्लस सीमेंट को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n`;
    } else {
      msg += `\n`;
    }

    if (order.points_awarded > 0) {
      const cNo = formatCoupons(order.coupon_number, order.points_awarded);
      msg += `🎟️ आपको मिले है कूपन नं: *${cNo}*\n🏆 आपके अब तक कुल कूपन: *${karigar.total_points}*\n\n"ख़ुशियों की बरसात" योजना अवधि (*1 जुलाई 2026* से *30 अगस्त 2027*) में, मोटरसाइकिल, फ्रिज, वाशिंग मशीन, जैसे कई आकर्षक उपहार जीतने के लिए अपने कूपन बढ़ाते रहें!\n\n`;
    } else {
      msg += `🏆 आपके अब तक कुल कूपन: *${karigar.total_points}*\n\n`;
    }
    
    msg += `हार्दिक बधाई व शुभकामनाएं\n— वर्धमान ग्रुप, टोंक`;
    let phone = karigar.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
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
      toast.success(`Bulk approved ${successData.length} orders`);
    } else {
      toast.success("Bulk approval complete.");
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

  const downloadCouponList = async () => {
    try {
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select('*, karigars(name, phone)')
        .eq('status', 'approved')
        .gt('points_awarded', 0)
        .order('order_time', { ascending: false });

      if (error) throw error;

      if (!allOrders || allOrders.length === 0) {
        toast.error("No coupons allotted yet.");
        return;
      }

      const headers = ["Name", "Phone", "Coupons Allotted", "Date"];
      const rows = allOrders.map((order: any) => {
        const name = order.karigars?.name || 'Unknown';
        const phone = order.karigars?.phone || '';
        const coupons = formatCoupons(order.coupon_number, order.points_awarded);
        const date = new Date(order.order_time).toLocaleDateString();
        return `"${name}","${phone}","${coupons}","${date}"`;
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `coupon_list_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download coupon list", err);
      toast.error("Failed to download coupon list");
    }
  };

  const downloadKarigarList = () => {
    if (karigars.length === 0) {
      toast.error("No customers found.");
      return;
    }

    const headers = ["Name", "Phone", "Total Coupons"];
    const rows = karigars.map((k) => {
      return `"${k.name}","${k.phone}","${k.total_points}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFollowUpClick = (e: React.MouseEvent, type: 'call' | 'whatsapp', phone: string) => {
    e.stopPropagation();
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) cleanedPhone = '91' + cleanedPhone;
    
    if (type === 'call') {
      window.location.href = `tel:+${cleanedPhone}`;
    } else {
      window.open(`https://wa.me/${cleanedPhone}`, '_blank');
    }
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading data...</div>;
  }

  const totalPointsGiven = karigars.reduce((acc, k) => acc + k.total_points, 0);
  
  // Filter out canceled orders for total stats
  const validDashboardOrders = dashboardOrders.filter(o => o.status !== 'cancelled' && o.status !== 'canceled');
  const totalBagsOrdered = validDashboardOrders.reduce((acc, o) => acc + (o.bags_ordered || 0), 0);
  const totalSariyaOrdered = validDashboardOrders.reduce((acc, o) => acc + (o.sariya_ordered || 0), 0);

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
                toast.error(data.error || "Incorrect PIN or Unauthorized");
                setPasswordInput("");
              }
            } catch (err) {
              toast.error("Network error");
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Elegant Header */}
      {/* Modern Sticky Admin Header */}
      <header className="bg-white border-b border-slate-200/90 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          
          {/* Top Bar: Logo + Admin Badge + Entity Switcher */}
          <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Image
                src="/v_logo.png"
                alt="Vardhman Logo"
                width={80}
                height={32}
                className="object-contain"
              />
              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Admin
              </span>
            </div>

            {/* Entity Mode Switcher (Karigar vs Dukandar) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => setEntityMode('karigar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  entityMode === 'karigar'
                    ? 'bg-white text-orange-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🔨 Karigar</span>
                {pendingOrders.length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setEntityMode('dukandar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  entityMode === 'dukandar'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏪 Dukandar</span>
                {dukandarPendingCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {dukandarPendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Sub-Tab Switcher (Approvals, Dashboard, Directory) for Karigar */}
          {entityMode === 'karigar' && (
            <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('approvals')}
                className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'approvals' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                <span>Approvals</span>
                {pendingOrders.length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'dashboard' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'directory' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>Directory</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 md:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {entityMode === 'dukandar' ? (
          <DukandarAdmin />
        ) : (
          <>
            {adminError && activeTab === 'approvals' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs" role="alert">
                <strong className="font-bold">Error loading data! </strong>
                <span className="block sm:inline">{adminError}</span>
              </div>
            )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="bg-transparent sm:bg-white sm:rounded-3xl p-0 sm:p-6 sm:shadow-sm sm:border sm:border-slate-200/80 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-6 gap-3">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 text-slate-900 px-1 sm:px-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                <span>Pending Approvals ({pendingOrders.length})</span>
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
                <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                        <th className="py-4 pl-6 w-12">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            checked={pendingOrders.length > 0 && selectedOrderIds.length === pendingOrders.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="py-4 px-4 font-semibold">Time</th>
                        <th className="py-4 px-4 font-semibold">Karigar</th>
                        <th className="py-4 px-4 font-semibold">Purchases</th>
                        <th className="py-4 px-4 font-semibold text-right">Points to Award</th>
                        <th className="py-4 px-6 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pendingOrders.map((o) => {
                        const isSelected = selectedOrderIds.includes(o.id);
                        return (
                          <tr key={o.id} className={`text-sm transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/60'}`}>
                            <td className="py-4 pl-6 border-b border-slate-50">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelectOrder(o.id)}
                              />
                            </td>
                            <td className="py-4 px-4 text-slate-500 border-b border-slate-50">
                              <div className="font-medium text-slate-900">{new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="text-xs mt-0.5">{new Date(o.order_time).toLocaleDateString()}</div>
                              <div className="text-[10px] mt-1.5 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full inline-block font-medium border border-slate-200">By: {o.entered_by || 'Staff'}</div>
                            </td>
                            <td className="py-4 px-4 border-b border-slate-50">
                              <div className="font-semibold text-slate-900">{o.karigars?.name || 'Unknown'}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{o.karigars?.phone}</div>
                            </td>
                            <td className="py-4 px-4 text-slate-700 border-b border-slate-50">
                              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium">
                                {[
                                  o.bags_ordered > 0 ? `${o.bags_ordered} bags` : null,
                                  o.sariya_ordered > 0 ? `₹${o.sariya_ordered} sariya` : null
                                ].filter(Boolean).join(' & ')}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right border-b border-slate-50">
                              <span className="font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200/50 px-3 py-1.5 rounded-lg text-xs tracking-wide">
                                C-No: {formatCoupons(o.coupon_number, o.points_awarded)}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right border-b border-slate-50">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleCancel(o.id)}
                                  disabled={cancelProcessingId === o.id || processingId === o.id || isBulkProcessing}
                                  className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
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
                                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {processingId === o.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                                      <span className="hidden xl:inline">Approve</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden flex flex-col gap-2.5">
                  {/* Select All Row for Mobile */}
                  {pendingOrders.length > 0 && (
                    <div className="flex items-center justify-between px-1.5 py-1 text-xs">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          checked={selectedOrderIds.length === pendingOrders.length}
                          onChange={toggleSelectAll}
                          id="selectAllMobile"
                        />
                        <label htmlFor="selectAllMobile" className="font-bold text-slate-700 select-none cursor-pointer">
                          Select All ({pendingOrders.length})
                        </label>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Auto-opens WhatsApp</span>
                    </div>
                  )}

                  {pendingOrders.map((o) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <div 
                        key={o.id} 
                        className={`bg-white p-3.5 rounded-2xl border transition-all shadow-xs flex flex-col gap-2.5 ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20' 
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* Header: Checkbox + Customer + Coupon Badge */}
                        <div className="flex items-start gap-2.5">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-1 shrink-0"
                            checked={isSelected}
                            onChange={() => toggleSelectOrder(o.id)}
                          />
                          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-900 text-base leading-snug truncate">{o.karigars?.name || 'Unknown'}</h3>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">{o.karigars?.phone}</p>
                            </div>
                            <span className="font-black text-xs text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-200/90 shrink-0">
                              C-No: {formatCoupons(o.coupon_number, o.points_awarded)}
                            </span>
                          </div>
                        </div>

                        {/* Order & Metadata Chips */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-orange-500 shrink-0" />
                            {[
                              o.bags_ordered > 0 ? `${o.bags_ordered} bags` : null,
                              o.sariya_ordered > 0 ? `₹${o.sariya_ordered} sariya` : null
                            ].filter(Boolean).join(' & ')}
                          </span>
                          <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5 shrink-0">
                            <span>{new Date(o.order_time).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}, {new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-slate-300">•</span>
                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-xs font-semibold text-slate-700">{o.entered_by || 'Staff'}</span>
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleCancel(o.id)}
                            disabled={cancelProcessingId === o.id || processingId === o.id || isBulkProcessing}
                            className="py-2.5 px-3 rounded-xl font-bold text-sm bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 border border-rose-200/80 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
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
                            type="button"
                            onClick={() => handleApprove(o.id)}
                            disabled={processingId === o.id || cancelProcessingId === o.id || isBulkProcessing}
                            className="py-2.5 px-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Karigars" value={karigars.length} icon={Users} color="text-blue-500 bg-blue-50" action={() => setActiveTab('directory')} actionText="View Directory" />
              <StatCard title="Points Distributed" value={totalPointsGiven} icon={Trophy} color="text-amber-500 bg-amber-50" />
              <StatCard title="Recent Bags (Last 200)" value={totalBagsOrdered} icon={Package} color="text-emerald-500 bg-emerald-50" />
              <StatCard title="Recent Sariya (Last 200)" value={`₹${totalSariyaOrdered}`} icon={Activity} color="text-indigo-500 bg-indigo-50" />
            </div>

            <div className="w-full">
              {/* Leaderboard */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Karigar Leaderboard
                  </h2>
                  <button onClick={downloadCouponList} className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm">
                    <Download className="w-4 h-4" />
                    Export Coupons
                  </button>
                </div>
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
              <div className="flex flex-col sm:flex-row gap-3">
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
                <button onClick={downloadKarigarList} className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shrink-0">
                  <Download className="w-4 h-4" />
                  Export Directory
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {karigars.filter(k => k.name.toLowerCase().includes(directorySearch.toLowerCase()) || k.phone.includes(directorySearch)).map((k) => (
                <div key={k.id} onClick={() => handleKarigarClick(k)} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 cursor-pointer transition-all flex justify-between items-start group">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{k.name}</h3>
                    <p className="text-sm text-slate-500 mb-2">{k.phone}</p>
                    <div className="flex gap-2 mt-1">
                      <button onClick={(e) => handleFollowUpClick(e, 'call', k.phone)} className="p-1.5 bg-white border border-slate-200 hover:bg-blue-50 rounded-lg shadow-sm transition-colors" title="Call Customer">
                        <img src="/call.webp" alt="Call" className="w-4 h-4 object-contain mix-blend-multiply contrast-125 drop-shadow-sm" />
                      </button>
                      <button onClick={(e) => handleFollowUpClick(e, 'whatsapp', k.phone)} className="p-1.5 bg-white border border-slate-200 hover:bg-emerald-50 rounded-lg shadow-sm transition-colors" title="WhatsApp Message">
                        <img src="/WhatsApp.webp" alt="WhatsApp" className="w-4 h-4 object-contain" />
                      </button>
                    </div>
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
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
                {editingKarigarId === selectedKarigarDetails.id ? (
                  <div className="flex-1 w-full space-y-3">
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border rounded-lg font-medium text-slate-900" placeholder="Name" />
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full p-2 border rounded-lg text-sm text-slate-600" placeholder="Phone" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleSaveKarigar(selectedKarigarDetails.id)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
                      <button onClick={() => setEditingKarigarId(null)} className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedKarigarDetails.name}</h2>
                    <p className="text-sm text-slate-500">{selectedKarigarDetails.phone} • Total Coupons: {selectedKarigarDetails.total_points}</p>
                    <div className="flex gap-2 mt-3 mb-3">
                      <button onClick={(e) => handleFollowUpClick(e, 'call', selectedKarigarDetails.phone)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
                        <img src="/call.webp" alt="Call" className="w-4 h-4 object-contain mix-blend-multiply contrast-125 drop-shadow-sm" />
                        Call
                      </button>
                      <button onClick={(e) => handleFollowUpClick(e, 'whatsapp', selectedKarigarDetails.phone)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors">
                        <img src="/WhatsApp.webp" alt="WhatsApp" className="w-4 h-4 object-contain" />
                        WhatsApp
                      </button>
                    </div>
                    <div className="flex gap-3 mt-3 pt-3 border-t border-slate-200/60">
                      <button onClick={() => handleEditKarigar(selectedKarigarDetails)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      <button onClick={() => handleDeleteKarigar(selectedKarigarDetails.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </div>
                  </div>
                )}
                <button onClick={() => setSelectedKarigarDetails(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600 shrink-0">
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
                        <div className="flex flex-col items-end gap-2 shrink-0 max-w-full sm:max-w-[50%]">
                          {o.points_awarded > 0 && (
                            <div className="text-left sm:text-right w-full">
                              <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold tracking-wider">Coupons Allotted</p>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 inline-block shadow-sm break-words max-w-full">
                                #{formatCoupons(o.coupon_number, o.points_awarded)}
                              </span>
                            </div>
                          )}
                          <button onClick={() => handleResendWhatsApp(o, selectedKarigarDetails)} className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
                            Resend WhatsApp
                          </button>
                        </div>
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

                        let msg = `नमस्ते ${w.name} जी! 🙏\n\n`;
                        if (orderDetails) {
                          msg += `✅ *ऑर्डर स्वीकृत:* ${orderDetails.replace('\n', ', ')}\n`;
                        }
                        if (w.bags > 0) {
                          msg += `परफैक्ट प्लस सीमेंट को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n`;
                        } else {
                          msg += `\n`;
                        }

                        if (w.pointsAwarded > 0) {
                          msg += `🎟️ आपको मिले है कूपन नं: *${w.couponCode}*\n🏆 आपके अब तक कुल कूपन: *${w.totalPoints}*\n\n"ख़ुशियों की बरसात" योजना अवधि (*1 जुलाई 2026* से *30 अगस्त 2027*) में, मोटरसाइकिल, फ्रिज, वाशिंग मशीन, जैसे कई आकर्षक उपहार जीतने के लिए अपने कूपन बढ़ाते रहें!\n\n`;
                        } else {
                          msg += `🏆 आपके अब तक कुल कूपन: *${w.totalPoints}*\n\n`;
                        }
                        
                        msg += `हार्दिक बधाई व शुभकामनाएं\n— वर्धमान ग्रुप, टोंक`;
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
          </>
        )}
      </main>
    </div>
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
