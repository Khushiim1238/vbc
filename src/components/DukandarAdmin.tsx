"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CheckCircle, Clock, Loader2, XCircle, CheckSquare, Trophy, 
  Package, Users, LayoutDashboard, ListChecks, Search, 
  Phone, MessageCircle, Plus, Edit2, Trash2, Store
} from "lucide-react";
import { toast } from "sonner";

interface Dukandar {
  id: string;
  name: string;
  phone: string;
  total_points: number;
}

interface DukandarPendingOrder {
  id: string;
  dukandar_id: string;
  bags_ordered: number;
  order_time: string;
  entered_by: string;
  points_awarded: number;
  status: string;
  dukandars?: { name: string; phone: string };
}

interface DukandarOrder {
  id: string;
  dukandar_id: string;
  bags_ordered: number;
  order_time: string;
  status: string;
  entered_by: string;
  points_awarded: number;
  dukandars?: { name: string; phone: string };
}

export default function DukandarAdmin() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'dashboard' | 'directory'>('approvals');

  // Approvals State
  const [pendingOrders, setPendingOrders] = useState<DukandarPendingOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancelProcessingId, setCancelProcessingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [bulkApprovedOrders, setBulkApprovedOrders] = useState<any[]>([]);

  // Dashboard State
  const [dukandars, setDukandars] = useState<Dukandar[]>([]);
  const [dashboardOrders, setDashboardOrders] = useState<DukandarOrder[]>([]);

  // Directory State
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedDukandarDetails, setSelectedDukandarDetails] = useState<Dukandar | null>(null);
  const [dukandarHistory, setDukandarHistory] = useState<DukandarOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit / Add Modal State
  const [editingDukandarId, setEditingDukandarId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [loading, setLoading] = useState(true);
  const dukandarsRef = useRef<Dukandar[]>([]);

  useEffect(() => {
    dukandarsRef.current = dukandars;
  }, [dukandars]);

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, dukandarsRes, ordersRes] = await Promise.all([
        supabase
          .from("dukandar_orders")
          .select("*, dukandars(name, phone)")
          .eq("status", "pending")
          .order("order_time", { ascending: true }),
        supabase
          .from("dukandars")
          .select("*")
          .order("total_points", { ascending: false }),
        supabase
          .from("dukandar_orders")
          .select("*, dukandars(name, phone)")
          .order("order_time", { ascending: false })
          .limit(200)
      ]);

      if (pendingRes.error) throw pendingRes.error;

      setPendingOrders((pendingRes.data as DukandarPendingOrder[]) || []);
      if (dukandarsRes.data) setDukandars(dukandarsRes.data as Dukandar[]);
      if (ordersRes.data) setDashboardOrders(ordersRes.data as DukandarOrder[]);
      setAdminError(null);
    } catch (err: any) {
      console.error("Failed to fetch dukandar admin data:", err);
      setAdminError(err.message || "Failed to fetch dukandar data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Realtime subscriptions
    const orderSub = supabase
      .channel("admin-dukandar-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dukandar_orders" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const dukandarSub = supabase
      .channel("admin-dukandars")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dukandars" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSub);
      supabase.removeChannel(dukandarSub);
    };
  }, []);

  // WhatsApp helper for Dukandar
  const triggerDukandarWhatsApp = (w: {
    phone: string;
    name: string;
    bags: number;
    pointsAwarded: number;
    totalPoints: number;
  }) => {
    let msg = `नमस्ते ${w.name} जी! 🙏\n\n`;
    msg += `✅ *ऑर्डर स्वीकृत:* सीमेंट: ${w.bags} बैग\n`;
    msg += `परफैक्ट प्लस सीमेंट को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n`;
    msg += `⭐ आपके खाते में जुड़े: *+${w.pointsAwarded} पॉइंट्स*\n`;
    msg += `🏆 आपका कुल पॉइंट्स बैलेंस: *${w.totalPoints} पॉइंट्स*\n\n`;
    msg += `हार्दिक बधाई व शुभकामनाएं\n— वर्धमान ग्रुप, टोंक`;

    let phone = w.phone.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Single Approve
  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      const res = await fetch("/api/dukandars/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await res.json();
      if (data.success) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
        toast.success("Dukandar order approved!");

        if (data.whatsapp_data) {
          triggerDukandarWhatsApp(data.whatsapp_data);
        }
        fetchData();
      } else {
        toast.error(data.error || "Approval failed");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setProcessingId(null);
    }
  };

  // Single Cancel
  const handleCancel = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this dukandar order?")) return;
    setCancelProcessingId(orderId);
    try {
      const res = await fetch("/api/dukandars/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await res.json();
      if (data.success) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
        toast.success("Order cancelled");
        fetchData();
      } else {
        toast.error(data.error || "Failed to cancel order");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setCancelProcessingId(null);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkProcessing(true);
    const successData: any[] = [];

    try {
      for (const orderId of selectedOrderIds) {
        const res = await fetch("/api/dukandars/orders/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        const data = await res.json();
        if (data.success && data.whatsapp_data) {
          successData.push(data.whatsapp_data);
        }
      }

      setPendingOrders((prev) => prev.filter((o) => !selectedOrderIds.includes(o.id)));
      setSelectedOrderIds([]);
      toast.success(`${successData.length} dukandar orders approved!`);
      if (successData.length > 0) {
        setBulkApprovedOrders(successData);
      }
      fetchData();
    } catch (err) {
      toast.error("Bulk approval error");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // View Directory Details
  const handleSelectDukandar = async (dukandar: Dukandar) => {
    setSelectedDukandarDetails(dukandar);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("dukandar_orders")
        .select("*")
        .eq("dukandar_id", dukandar.id)
        .order("order_time", { ascending: false });

      if (error) throw error;
      setDukandarHistory(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load passbook history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Update Dukandar
  const handleSaveEdit = async () => {
    if (!editingDukandarId || !editName || !editPhone) return;
    try {
      const res = await fetch(`/api/dukandars/${editingDukandarId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Dukandar updated successfully");
        setEditingDukandarId(null);
        fetchData();
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  // Delete Dukandar
  const handleDeleteDukandar = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? All associated orders will also be deleted!`)) return;
    try {
      const res = await fetch(`/api/dukandars/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Dukandar deleted");
        if (selectedDukandarDetails?.id === id) setSelectedDukandarDetails(null);
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  // Add New Dukandar
  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Both name and phone number are required");
      return;
    }
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      const res = await fetch("/api/dukandars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), phone: cleanPhone }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("New dukandar added successfully");
        setIsAddingNew(false);
        setNewName("");
        setNewPhone("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to add dukandar");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  // Resend WhatsApp Statement
  const handleSendStatement = (dukandar: Dukandar) => {
    let msg = `नमस्ते ${dukandar.name} जी! 🙏\n\n`;
    msg += `वर्धमान बिल्डिंग सेंटर में आपका स्वागत है।\n`;
    msg += `🏆 आपका कुल पॉइंट्स बैलेंस: *${dukandar.total_points} पॉइंट्स*\n\n`;
    msg += `परफैक्ट प्लस सीमेंट में आपके निरंतर सहयोग के लिए धन्यवाद।\n— वर्धमान ग्रुप, टोंक`;

    let phone = dukandar.phone.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const filteredDukandars = dukandars.filter(
    (d) =>
      d.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
      d.phone.includes(directorySearch)
  );

  // Stats calculation
  const totalBags = dashboardOrders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (o.bags_ordered || 0), 0);
  const totalPoints = dashboardOrders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (o.points_awarded || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sub Tabs for Dukandar: Approvals, Dashboard, Directory */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "approvals"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ListChecks className="w-3.5 h-3.5 shrink-0 text-blue-600" />
          <span>Approvals</span>
          {pendingOrders.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {pendingOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "dashboard"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "directory"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span>Directory</span>
        </button>
      </div>

      {adminError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs">
          <strong>Error: </strong> {adminError}
        </div>
      )}

      {/* 1. APPROVALS TAB */}
      {activeTab === "approvals" && (
        <div className="bg-transparent sm:bg-white sm:rounded-3xl p-0 sm:p-6 sm:shadow-sm sm:border sm:border-slate-200/80 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-6 gap-3 pb-2 sm:pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span>Pending Dukandar Orders ({pendingOrders.length})</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rule: 1 Bag = 1 Point (Cement Orders)
              </p>
            </div>

            {selectedOrderIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                  {selectedOrderIds.length} Selected
                </span>
                <button
                  onClick={handleBulkApprove}
                  disabled={isBulkProcessing}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                >
                  {isBulkProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  Bulk Approve
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
              Loading pending orders...
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">You're all caught up!</h3>
              <p className="text-xs text-slate-500 mt-1">No pending dukandar orders to review.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Select All Checkbox */}
              <div className="flex items-center justify-between px-1.5 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      pendingOrders.length > 0 &&
                      selectedOrderIds.length === pendingOrders.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(pendingOrders.map((o) => o.id));
                      } else {
                        setSelectedOrderIds([]);
                      }
                    }}
                    id="selectAllDukandarMobile"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="selectAllDukandarMobile" className="font-bold text-slate-700 select-none cursor-pointer">
                    Select All ({pendingOrders.length})
                  </label>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Auto-opens WhatsApp</span>
              </div>

              {pendingOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`bg-white p-3.5 rounded-2xl border transition-all shadow-xs flex flex-col gap-2.5 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500/20"
                        : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    {/* Header: Checkbox + Dukandar + Points Badge */}
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedOrderIds((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== order.id)
                              : [...prev, order.id]
                          );
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base leading-snug truncate">
                            {order.dukandars?.name || "Unknown Dukandar"}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{order.dukandars?.phone}</p>
                        </div>
                        <span className="font-black text-xs text-blue-800 bg-blue-100/90 px-3 py-1 rounded-full border border-blue-200/90 shrink-0">
                          +{order.points_awarded} Points
                        </span>
                      </div>
                    </div>

                    {/* Order & Metadata Chips */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        {order.bags_ordered} Bags Cement
                      </span>
                      <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5 shrink-0">
                        <span>
                          {new Date(order.order_time).toLocaleDateString([], { month: "numeric", day: "numeric" })},{" "}
                          {new Date(order.order_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-xs font-semibold text-slate-700">
                          {order.entered_by || "Staff"}
                        </span>
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelProcessingId === order.id}
                        className="py-2.5 px-3 rounded-xl font-bold text-sm bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 border border-rose-200/80 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {cancelProcessingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(order.id)}
                        disabled={processingId === order.id}
                        className="py-2.5 px-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {processingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                <Store className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Total Dukandars</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{dukandars.length}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                <Package className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Approved Cement Bags</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalBags} Bags</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
                <Trophy className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Total Points Awarded</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalPoints} ★</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Pending Approvals</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{pendingOrders.length}</p>
            </div>
          </div>

          {/* Leaderboard and Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Dukandars */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Top Dukandars (Points Leaderboard)
              </h3>
              <div className="space-y-3">
                {dukandars.slice(0, 5).map((d, index) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-50 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{d.name}</p>
                        <p className="text-xs text-slate-400">{d.phone}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                      {d.total_points} Points
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> Recent Approved Orders
              </h3>
              <div className="space-y-3">
                {dashboardOrders
                  .filter((o) => o.status === "approved")
                  .slice(0, 5)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {o.dukandars?.name || "Dukandar"}
                        </p>
                        <p className="text-slate-400">
                          {o.bags_ordered} Bags Cement • {new Date(o.order_time).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        +{o.points_awarded} Points
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DIRECTORY TAB */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search dukandars (name or phone)..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => setIsAddingNew(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                + Add New Dukandar
              </button>
            </div>

            {/* Dukandars Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Dukandar</th>
                    <th className="py-3 px-3">Mobile</th>
                    <th className="py-3 px-3 text-center">Total Points</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDukandars.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                        {editingDukandarId === d.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="p-1 border border-blue-400 rounded text-xs font-normal"
                          />
                        ) : (
                          d.name
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {editingDukandarId === d.id ? (
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="p-1 border border-blue-400 rounded text-xs font-normal"
                          />
                        ) : (
                          d.phone
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                          {d.total_points} ★
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {editingDukandarId === d.id ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingDukandarId(null)}
                              className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSelectDukandar(d)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold"
                              title="View Passbook & Order History"
                            >
                              Passbook
                            </button>
                            <button
                              onClick={() => handleSendStatement(d)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold"
                              title="Send WhatsApp Statement"
                            >
                              WhatsApp
                            </button>
                            <button
                              onClick={() => {
                                setEditingDukandarId(d.id);
                                setEditName(d.name);
                                setEditPhone(d.phone);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title="Edit Dukandar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDukandar(d.id, d.name)}
                              className="p-1 text-rose-400 hover:text-rose-600"
                              title="Delete Dukandar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Passbook History for Selected Dukandar */}
          {selectedDukandarDetails && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedDukandarDetails.name}'s Passbook
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mobile: {selectedDukandarDetails.phone} • Total Balance:{" "}
                    <span className="font-bold text-blue-600">
                      {selectedDukandarDetails.total_points} Points
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDukandarDetails(null)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕ Close
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading passbook...
                </div>
              ) : dukandarHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No order history found.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {dukandarHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          Cement: {h.bags_ordered} Bags
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(h.order_time).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            h.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {h.status === "approved" ? "Approved" : "Pending"}
                        </span>
                        <span className="font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          +{h.points_awarded} ★
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add New Dukandar Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" /> Add New Dukandar
            </h3>
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dukandar / Firm Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Agarwal Traders"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  Save Dukandar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Approved WhatsApp Modal */}
      {bulkApprovedOrders.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Send WhatsApp Notifications ({bulkApprovedOrders.length})
            </h3>
            <p className="text-xs text-slate-500">
              Send 1-click WhatsApp notification to each approved dukandar:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {bulkApprovedOrders.map((w, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{w.name}</p>
                    <p className="text-slate-400">+{w.pointsAwarded} Points • Total: {w.totalPoints}</p>
                  </div>
                  <button
                    onClick={() => triggerDukandarWhatsApp(w)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Send
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setBulkApprovedOrders([])}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
