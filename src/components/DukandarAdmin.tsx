"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle, Clock, Loader2, XCircle, X, CheckSquare, Trophy,
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
  sariya_ordered: number;
  pole_ordered: number;
  cover_block_ordered?: number;
  binding_wire_ordered?: number;
  tile_ordered: number;
  order_time: string;
  entered_by: string;
  points_awarded: number;
  coupon_number?: number;
  status: string;
  dukandars?: { name: string; phone: string };
}

interface DukandarOrder {
  id: string;
  dukandar_id: string;
  bags_ordered: number;
  sariya_ordered: number;
  pole_ordered: number;
  cover_block_ordered?: number;
  binding_wire_ordered?: number;
  tile_ordered: number;
  order_time: string;
  status: string;
  entered_by: string;
  points_awarded: number;
  coupon_number?: number;
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
    sariya?: number;
    pole?: number;
    cover_block?: number;
    binding_wire?: number;
    tile?: number;
    pointsAwarded: number;
    totalPoints: number;
    couponNumber?: number;
  }) => {
    const itemsList: string[] = [];
    if (w.bags > 0) itemsList.push(`सीमेंट: ${w.bags} बैग`);
    if ((w.sariya || 0) > 0) itemsList.push(`सरिया: ₹${(w.sariya || 0).toLocaleString('en-IN')}`);
    if ((w.pole || 0) > 0) itemsList.push(`पोल: ${w.pole} नग`);
    if ((w.cover_block || 0) > 0) itemsList.push(`कवर ब्लॉक: ₹${(w.cover_block || 0).toLocaleString('en-IN')}`);
    if ((w.binding_wire || 0) > 0) itemsList.push(`बाइंडिंग वायर: ₹${(w.binding_wire || 0).toLocaleString('en-IN')}`);
    if ((w.tile || 0) > 0) itemsList.push(`अन्य सामग्री (टाइल्स, सीमेंट ब्लॉक): ₹${(w.tile || 0).toLocaleString('en-IN')}`);

    const itemsText = itemsList.length > 0 ? itemsList.join(", ") : `सीमेंट: ${w.bags || 0} बैग`;

    let msg = `नमस्ते ${w.name} जी! 🙏\n\n`;
    msg += `✅ *ऑर्डर स्वीकृत:* ${itemsText}\n`;
    msg += `वर्धमान बिल्डिंग सल्यूशन को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n\n`;
    msg += `⭐ आपको मिले हैं: *+${w.pointsAwarded} पॉइंट्स*\n`;
    msg += `🏆 आपका कुल पॉइंट्स है: *${w.totalPoints} पॉइंट्स*\n\n`;
    msg += `दीपावली धमाका स्कीम में  मोटरसाइकिल , ए सी,फ्रिज ,कूलर आदि आकर्षक इनाम जीतने के लिए अपने प्वाइंट बढ़ाते रहिए!\n\n`;
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

  const handleCallCustomer = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    window.open(`tel:+${cleanPhone}`, "_self");
  };

  const handleResendHistoryWhatsApp = (order: DukandarOrder, dukandar: Dukandar) => {
    triggerDukandarWhatsApp({
      name: dukandar.name,
      phone: dukandar.phone,
      bags: order.bags_ordered,
      sariya: order.sariya_ordered,
      pole: order.pole_ordered,
      cover_block: order.cover_block_ordered,
      binding_wire: order.binding_wire_ordered,
      tile: order.tile_ordered,
      pointsAwarded: order.points_awarded,
      totalPoints: dukandar.total_points,
      couponNumber: order.coupon_number,
    });
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
  const totalSariya = dashboardOrders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (o.sariya_ordered || 0), 0);
  const totalPole = dashboardOrders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (o.pole_ordered || 0), 0);
  const totalTile = dashboardOrders
    .filter((o) => o.status === "approved")
    .reduce((sum, o) => sum + (o.tile_ordered || 0), 0);
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
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "approvals"
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
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "dashboard"
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
          className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "directory"
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
                    className={`bg-white p-3.5 rounded-2xl border transition-all shadow-xs flex flex-col gap-2.5 ${isSelected
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
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        {[
                          order.bags_ordered > 0 ? `${order.bags_ordered} Bags Cement` : null,
                          order.sariya_ordered > 0 ? `₹${order.sariya_ordered.toLocaleString('en-IN')} Sariya` : null,
                          order.pole_ordered > 0 ? `${order.pole_ordered} Poles` : null,
                          order.tile_ordered > 0 ? `₹${order.tile_ordered.toLocaleString('en-IN')} Others` : null,
                        ].filter(Boolean).join(" • ") || `${order.bags_ordered || 0} Bags Cement`}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-2.5">
                <Store className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Total Dukandars</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{dukandars.length}</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-2.5">
                <Package className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Approved Cement</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{totalBags} Bags</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center mb-2.5">
                <span className="font-bold text-base">₹</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Approved Sariya</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">₹{totalSariya.toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-2.5">
                <span className="font-bold text-base">₹</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Approved Pole</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">₹{totalPole.toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-2.5">
                <span className="font-bold text-base">₹</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Approved Tiles</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">₹{totalTile.toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-2.5">
                <Trophy className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Total Points</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{totalPoints} ★</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-2.5">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Pending Approvals</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{pendingOrders.length}</p>
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
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
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
                          {[
                            o.bags_ordered > 0 ? `${o.bags_ordered} Bags Cement` : null,
                            o.sariya_ordered > 0 ? `₹${o.sariya_ordered.toLocaleString('en-IN')} Sariya` : null,
                            o.pole_ordered > 0 ? `${o.pole_ordered} Poles` : null,
                            o.tile_ordered > 0 ? `₹${o.tile_ordered.toLocaleString('en-IN')} Others` : null,
                          ].filter(Boolean).join(" • ") || `${o.bags_ordered || 0} Bags Cement`} • {new Date(o.order_time).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-xs">
                          +{o.points_awarded} Points
                        </span>
                      </div>
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

            {/* Dukandars Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDukandars.map((d) => (
                <div
                  key={d.id}
                  onClick={() => handleSelectDukandar(d)}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all flex justify-between items-start group shadow-2xs"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                      {d.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mb-3 mt-0.5">
                      {d.phone}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleCallCustomer(e, d.phone)}
                        className="p-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                        title="Call Dukandar"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendStatement(d);
                        }}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                        title="Send WhatsApp Statement"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5 group-hover:underline ml-1">
                        Passbook →
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-100/90 text-blue-800 px-3 py-1.5 rounded-xl font-black text-sm border border-blue-200 shadow-2xs whitespace-nowrap">
                    {d.total_points} ⭐
                  </div>
                </div>
              ))}

              {filteredDukandars.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm">
                  No dukandars found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* Passbook History Modal for Selected Dukandar */}
          {selectedDukandarDetails && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => {
                setSelectedDukandarDetails(null);
                setEditingDukandarId(null);
              }}
            >
              <div
                className="bg-white rounded-3xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70">
                  {editingDukandarId === selectedDukandarDetails.id ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-800 text-sm">Edit Dukandar Details</h4>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Dukandar / Firm Name"
                      />
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-blue-500"
                        placeholder="10-digit Phone Number"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveEdit}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingDukandarId(null)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-black text-slate-900 truncate">
                            {selectedDukandarDetails.name}
                          </h2>
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-xl font-black text-xs border border-blue-200">
                            {selectedDukandarDetails.total_points} Points ⭐
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Mobile: {selectedDukandarDetails.phone}
                        </p>

                        {/* Action Bar */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={(e) => handleCallCustomer(e, selectedDukandarDetails.phone)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </button>
                          <button
                            onClick={() => handleSendStatement(selectedDukandarDetails)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp Statement
                          </button>
                          <button
                            onClick={() => {
                              setEditingDukandarId(selectedDukandarDetails.id);
                              setEditName(selectedDukandarDetails.name);
                              setEditPhone(selectedDukandarDetails.phone);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteDukandar(selectedDukandarDetails.id, selectedDukandarDetails.name);
                              setSelectedDukandarDetails(null);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedDukandarDetails(null);
                          setEditingDukandarId(null);
                        }}
                        className="p-2 hover:bg-slate-200/80 rounded-full transition-colors text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/40">
                  {loadingHistory ? (
                    <div className="flex flex-col justify-center items-center py-12 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-xs font-medium">Loading orders history...</p>
                    </div>
                  ) : dukandarHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 text-sm">
                      No orders logged for this dukandar yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dukandarHistory.map((h) => {
                        const isApproved = h.status === "approved";
                        const isCancelled = h.status === "cancelled";

                        return (
                          <div
                            key={h.id}
                            className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-200 transition-all"
                          >
                            <div>
                              <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(h.order_time).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                                <span
                                  className={`text-[10px] ml-1.5 px-2 py-0.5 rounded-full font-bold uppercase ${
                                    isApproved
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isCancelled
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {h.status}
                                </span>
                              </div>

                              <div className="font-semibold text-xs text-slate-700 bg-slate-50 inline-block px-3 py-1.5 rounded-xl border border-slate-100">
                                {[
                                  h.bags_ordered > 0 ? `${h.bags_ordered} Bags Cement` : null,
                                  h.sariya_ordered > 0 ? `₹${h.sariya_ordered.toLocaleString("en-IN")} Sariya` : null,
                                  h.pole_ordered > 0 ? `${h.pole_ordered} Poles` : null,
                                  (h.cover_block_ordered || 0) > 0 ? `₹${(h.cover_block_ordered || 0).toLocaleString("en-IN")} Cover Block` : null,
                                  (h.binding_wire_ordered || 0) > 0 ? `₹${(h.binding_wire_ordered || 0).toLocaleString("en-IN")} Binding Wire` : null,
                                  h.tile_ordered > 0 ? `₹${h.tile_ordered.toLocaleString("en-IN")} Others` : null,
                                ].filter(Boolean).join(" • ") || `${h.bags_ordered || 0} Bags Cement`}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                              <div className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-blue-700 uppercase">Points</p>
                                <p className="text-sm font-black text-blue-600">+{h.points_awarded}</p>
                              </div>
                              <button
                                onClick={() => handleResendHistoryWhatsApp(h, selectedDukandarDetails)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 flex items-center gap-1.5 text-xs transition-colors cursor-pointer shadow-2xs"
                                title="Resend WhatsApp Confirmation"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
                    <p className="text-slate-400">
                      +{w.pointsAwarded} Points • Total: {w.totalPoints}
                    </p>
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
