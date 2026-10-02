"use client";

import { useState, useEffect } from "react";
import { 
  Search, Plus, User, Package, Trophy, Lock, Users, 
  Loader2, Phone, MessageCircle, Clock, CheckCircle2, 
  Store, X, RefreshCw, ChevronRight, Edit2 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Dukandar {
  id: string;
  name: string;
  phone: string;
  total_points: number;
}

interface DukandarTransaction {
  id: string;
  dukandar_id: string;
  bags_ordered: number;
  order_time: string;
  status: string;
  points_awarded: number;
  dukandars?: { name: string; phone: string };
}

export default function DukandarOrderEntry() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [activeTab, setActiveTab] = useState<'order' | 'transactions' | 'customer_history'>('order');
  
  const [dukandars, setDukandars] = useState<Dukandar[]>([]);
  const [transactions, setTransactions] = useState<DukandarTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success state
  const [success, setSuccess] = useState<{
    customerName: string;
    bags: number;
    points: number;
  } | null>(null);

  // Form State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDukandar, setSelectedDukandar] = useState("");
  const [selectedDukandarName, setSelectedDukandarName] = useState("");

  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newDukandarName, setNewDukandarName] = useState("");
  const [newDukandarPhone, setNewDukandarPhone] = useState("");

  const [bags, setBags] = useState<number | "">("");
  const [enteredBy, setEnteredBy] = useState("Staff");

  // Customer History Tab State
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [selectedDukandarDetails, setSelectedDukandarDetails] = useState<Dukandar | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<DukandarTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Resolve staff name reliably across sessions, localStorage, and legacy keys
  const getStoredStaffName = (fallbackRole?: string) => {
    if (typeof window === 'undefined') return fallbackRole === 'admin' ? 'Admin' : 'Staff';
    const direct = localStorage.getItem("vbc_staff_name");
    if (direct && direct.trim() && direct.trim().toLowerCase() !== 'staff') {
      return direct.trim();
    }
    try {
      const dev = localStorage.getItem("vardhman_device");
      if (dev) {
        const parsed = JSON.parse(dev);
        if (parsed?.name && parsed.name.trim() && parsed.name.trim().toLowerCase() !== 'staff') {
          localStorage.setItem("vbc_staff_name", parsed.name.trim());
          return parsed.name.trim();
        }
      }
    } catch {}
    const legacy = localStorage.getItem("staff_name") || localStorage.getItem("user_name");
    if (legacy && legacy.trim() && legacy.trim().toLowerCase() !== 'staff') {
      localStorage.setItem("vbc_staff_name", legacy.trim());
      return legacy.trim();
    }
    return direct && direct.trim() ? direct.trim() : (fallbackRole === 'admin' ? 'Admin' : 'Staff');
  };

  const handleStaffBadgeClick = () => {
    const current = enteredBy === 'Staff' || enteredBy === 'Admin' ? '' : enteredBy;
    const newName = window.prompt("Enter your staff name:", current);
    if (newName !== null && newName.trim() !== '') {
      const trimmed = newName.trim();
      localStorage.setItem("vbc_staff_name", trimmed);
      setEnteredBy(trimmed);
      toast.success(`Staff name set to ${trimmed}`);
    }
  };

  // Check existing session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          const savedName = getStoredStaffName(data.role);
          setEnteredBy(savedName);
          fetchDukandars();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        const savedName = getStoredStaffName(data.role);
        setEnteredBy(savedName);
        fetchDukandars();
        toast.success("Welcome back!");
      } else {
        toast.error(data.error || "Invalid PIN");
        setPasswordInput("");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const fetchDukandars = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dukandars");
      if (res.ok) {
        const data = await res.json();
        setDukandars(data || []);
      }
    } catch (err) {
      console.error("Error fetching dukandars:", err);
      toast.error("Failed to load dukandars");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch("/api/dukandars/orders");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data || []);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      toast.error("Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions' && isAuthenticated) {
      fetchTransactions();
    }
  }, [activeTab, isAuthenticated]);

  // Realtime subscription for Dukandar orders
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel("public:dukandar_orders_staff")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dukandar_orders" },
        () => {
          if (activeTab === 'transactions') {
            fetchTransactions();
          }
          fetchDukandars();
          if (selectedDukandarDetails) {
            handleViewCustomerHistory(selectedDukandarDetails);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, activeTab, selectedDukandarDetails]);

  // View Customer History
  const handleViewCustomerHistory = async (dukandar: Dukandar) => {
    setSelectedDukandarDetails(dukandar);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('dukandar_orders')
        .select('*')
        .eq('dukandar_id', dukandar.id)
        .order('order_time', { ascending: false });

      if (error) throw error;
      setCustomerTransactions(data || []);
    } catch (err) {
      console.error("Error loading dukandar history:", err);
      toast.error("Failed to load customer history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // WhatsApp in Hindi as requested
  const handleResendWhatsApp = (order: DukandarTransaction, dukandar: Dukandar) => {
    const orderDetails = `सीमेंट: ${order.bags_ordered} बैग`;

    let msg = `नमस्ते ${dukandar.name} जी! 🙏\n\n`;
    msg += `✅ *ऑर्डर विवरण:* ${orderDetails}\n`;
    msg += `परफैक्ट प्लस सीमेंट को आपके द्वारा दिए गए सहयोग के लिए धन्यवाद।\n\n`;

    if (order.status === 'approved') {
      msg += `⭐ इस ऑर्डर के पॉइंट्स: *+${order.points_awarded} पॉइंट्स*\n`;
      msg += `🏆 आपका कुल पॉइंट्स बैलेंस: *${dukandar.total_points} पॉइंट्स*\n\n`;
    } else if (order.status === 'pending') {
      msg += `⏳ *स्थिति:* आपका ऑर्डर वेरिफिकेशन के लिए प्रोसेस में है।\n⭐ संभावित पॉइंट्स: *${order.points_awarded} पॉइंट्स*\n\n`;
    }

    msg += `हार्दिक बधाई व शुभकामनाएं\n— वर्धमान ग्रुप, टोंक`;

    let phone = dukandar.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleFollowUpClick = (type: 'call' | 'whatsapp', phone: string) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (type === 'call') {
      window.open(`tel:+${cleanPhone}`, '_self');
    } else {
      const msg = `नमस्ते जी! वर्धमान बिल्डिंग सेंटर से संपर्क करने के लिए धन्यवाद।`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    const submittedBags = Number(bags) || 0;
    if (submittedBags <= 0) {
      toast.error("Please enter a valid cement bags quantity");
      return;
    }

    let targetDukandarId = selectedDukandar;
    let targetCustomerName = selectedDukandarName;

    if (isNewCustomer) {
      if (!newDukandarName.trim() || !newDukandarPhone.trim()) {
        toast.error("Please provide both name and phone number for the new dukandar");
        return;
      }

      const cleanPhone = newDukandarPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        toast.error("Please enter a valid 10-digit phone number");
        return;
      }

      setSubmitting(true);
      try {
        const createRes = await fetch("/api/dukandars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newDukandarName.trim(),
            phone: cleanPhone
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok || !createData.success) {
          toast.error(createData.error || "Failed to create new dukandar");
          setSubmitting(false);
          return;
        }

        targetDukandarId = createData.dukandar.id;
        targetCustomerName = createData.dukandar.name;
      } catch (err) {
        console.error("Error creating dukandar:", err);
        toast.error("Network error while creating dukandar");
        setSubmitting(false);
        return;
      }
    }

    if (!targetDukandarId) {
      toast.error("Please select or add a dukandar");
      return;
    }

    setSubmitting(true);
    setSuccess(null);

    // Rule for Dukandar: 1 bag = 1 point
    const calculatedPoints = submittedBags;

    try {
      const res = await fetch("/api/dukandars/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dukandar_id: targetDukandarId,
          bags_ordered: submittedBags,
          entered_by: enteredBy,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({
          customerName: targetCustomerName,
          bags: submittedBags,
          points: calculatedPoints,
        });

        // Clear fields
        setBags("");
        setSelectedDukandar("");
        setSelectedDukandarName("");
        setNewDukandarName("");
        setNewDukandarPhone("");
        setSearchQuery("");
        setIsNewCustomer(false);
        fetchDukandars();
      } else {
        toast.error(data.error || "Failed to submit order");
      }
    } catch (err) {
      console.error("Error submitting order:", err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDukandars = dukandars.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.phone.includes(searchQuery)
  );

  const filteredHistoryDukandars = dukandars.filter(d =>
    d.name.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    d.phone.includes(historySearchQuery)
  );

  // Authentication Screen
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Dukandar Portal</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your 4-digit staff PIN</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-white/5 border border-white/10 rounded-2xl text-white mb-6 focus:outline-none focus:border-blue-400 transition-all font-mono"
              placeholder="••••"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-blue-600/30 active:scale-95"
            >
              Unlock Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 pb-16">
      {/* Mobile-Optimized Native Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-2">
            <Image
              src="/v_logo.png"
              alt="Vardhman Logo"
              width={82}
              height={32}
              className="object-contain"
            />
            <div className="hidden sm:block pl-2 border-l border-slate-200 text-xs text-slate-500 font-medium">
              Dukandar Portal
            </div>
          </div>

          {/* Segmented Portal Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-inner">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              title="Switch to Karigar Portal"
            >
              <span>🔨</span>
              <span className="hidden sm:inline">Karigar</span>
            </Link>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow-sm border border-slate-200/60">
              <span>🏪</span>
              <span>Dukandar</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse ml-0.5"></span>
            </div>
          </div>

          {/* Staff Badge */}
          <button
            type="button"
            onClick={handleStaffBadgeClick}
            title="Tap to change staff name"
            className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full font-semibold border border-blue-200/60 shrink-0 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>{enteredBy}</span>
            <Edit2 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Native Segmented Tab Switcher */}
        <div className="flex p-1 bg-slate-200/80 rounded-2xl w-full mb-5 shadow-inner">
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'order' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Order</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'transactions' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Transactions</span>
          </button>
          <button
            onClick={() => setActiveTab('customer_history')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'customer_history' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Passbook</span>
          </button>
        </div>

        {/* TAB 1: NEW ORDER */}
        {activeTab === 'order' && (
          <div className="animate-in fade-in duration-200">
            {/* Success Overlay Modal */}
            {success && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-blue-50">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-1">Order Logged!</h2>
                  <p className="text-slate-600 text-xs sm:text-sm mb-5">
                    Order for <span className="font-bold text-slate-900">{success.customerName}</span> has been submitted.
                  </p>
                  
                  <div className="bg-blue-50 w-full rounded-2xl p-4 mb-5 border border-blue-200/80">
                    <p className="text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">Points Allotted</p>
                    <p className="text-3xl font-black text-blue-600 tracking-wider">
                      +{success.points} Points
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">({success.bags} Bags = {success.points} Points)</p>
                  </div>

                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2 mb-5 w-full">
                    ⏳ Points will be credited upon Admin approval.
                  </p>

                  <button
                    onClick={() => setSuccess(null)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold shadow-lg shadow-blue-600/25 transition-all text-sm"
                  >
                    Done (Log Next Order)
                  </button>
                </div>
              </div>
            )}

            {/* Order Card Container */}
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              
              {/* 1. Customer Selection Card */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Dukandar Details</h3>
                      <p className="text-[11px] text-slate-500">Select or add a Shopkeeper</p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(false)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        !isNewCustomer ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(true)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        isNewCustomer ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      + New
                    </button>
                  </div>
                </div>

                {!isNewCustomer ? (
                  <div className="space-y-2">
                    {/* Selected Banner */}
                    {selectedDukandar ? (
                      <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                            {selectedDukandarName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{selectedDukandarName}</p>
                            <p className="text-xs text-blue-700 mt-0.5">
                              {dukandars.find(d => d.id === selectedDukandar)?.phone} • {dukandars.find(d => d.id === selectedDukandar)?.total_points || 0} Points
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDukandar("");
                            setSelectedDukandarName("");
                            setSearchQuery("");
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-2.5 py-1.5 rounded-xl border border-blue-200 shadow-sm"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search dukandar by name or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-9 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                              title="Clear search"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Search Dropdown */}
                        {searchQuery && !selectedDukandar && (
                          <div className="mt-2 max-h-56 overflow-y-auto border border-blue-100 rounded-2xl bg-white shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150">
                            {filteredDukandars.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                No dukandar found. Click <strong>"+ New"</strong> above to register.
                              </div>
                            ) : (
                              filteredDukandars.map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDukandar(d.id);
                                    setSelectedDukandarName(d.name);
                                    setSearchQuery("");
                                  }}
                                  className="w-full p-3 text-left hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                      {d.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 text-sm">{d.name}</p>
                                      <p className="text-slate-400">{d.phone}</p>
                                    </div>
                                  </div>
                                  <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 shrink-0">
                                    {d.total_points} ★
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Dukandar / Firm Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Agarwal Traders"
                        value={newDukandarName}
                        onChange={(e) => setNewDukandarName(e.target.value)}
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Number (10 digits) *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="e.g. 9876543210"
                        value={newDukandarPhone}
                        onChange={(e) => setNewDukandarPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Order Quantities Card (Cement Only) */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Cement Quantity</h3>
                    <p className="text-[11px] text-slate-500">Rule: 1 Bag = 1 Point</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cement Bags (सीमेंट बोरी)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={bags}
                      onChange={(e) => setBags(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full pl-4 pr-14 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase select-none">
                      Bags
                    </span>
                  </div>
                </div>

                {/* Live Point Award Banner */}
                {Number(bags) > 0 && (
                  <div className="p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/5 border border-blue-200/80 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm font-bold text-sm">
                        ★
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-blue-950 uppercase tracking-wider">Points Earned</p>
                        <p className="text-lg font-black text-blue-600 leading-tight">
                          +{bags} Points
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      1 Bag = 1 Pt
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Action Submit Button */}
              <button
                type="submit"
                disabled={submitting || (!selectedDukandar && !isNewCustomer) || !bags || Number(bags) <= 0}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting Order...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirm & Submit Order
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent Dukandar Orders</h3>
                <p className="text-xs text-slate-400">Review status and points</p>
              </div>
              <button
                onClick={fetchTransactions}
                disabled={loadingTransactions}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loadingTransactions ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                Loading orders...
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200 text-xs">
                No dukandar orders logged yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {transactions.map((t) => {
                  const isApproved = t.status === 'approved';
                  const isCancelled = t.status === 'cancelled';
                  
                  return (
                    <div
                      key={t.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                          isApproved ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isApproved ? '✓' : isCancelled ? '✕' : '⏳'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{t.dukandars?.name || 'Dukandar'}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isApproved ? 'bg-emerald-100 text-emerald-800' : isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t.dukandars?.phone} • {new Date(t.order_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                            {t.bags_ordered} Bags Cement
                          </span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-blue-700 uppercase">Points</p>
                          <p className="text-sm font-black text-blue-600">
                            +{t.points_awarded}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DUKANDAR PASSBOOK */}
        {activeTab === 'customer_history' && (
          <div className="space-y-3.5 animate-in fade-in duration-200 pb-10">
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-sm flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Search dukandar by name or phone..." 
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 font-medium transition-all"
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {historySearchQuery && (
                <button
                  type="button"
                  onClick={() => setHistorySearchQuery('')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5"
                >
                  Clear
                </button>
              )}
            </div>

            {/* List Header Info */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-600">
                {filteredHistoryDukandars.length} {filteredHistoryDukandars.length === 1 ? 'Dukandar' : 'Dukandars'}
              </p>
              <p className="text-[11px] text-slate-400">Tap to view history</p>
            </div>

            {/* Dukandar List (Full natural mobile layout, no max-h truncation) */}
            {filteredHistoryDukandars.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200 shadow-sm text-xs">
                No dukandars found matching &quot;{historySearchQuery}&quot;
              </div>
            ) : (
              <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                {filteredHistoryDukandars.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleViewCustomerHistory(d)}
                    className="p-3.5 bg-white hover:bg-blue-50/60 active:scale-[0.99] border border-slate-200/90 hover:border-blue-300 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-base leading-snug">{d.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{d.phone}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowUpClick('call', d.phone);
                          }}
                          className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl shadow-xs"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowUpClick('whatsapp', d.phone);
                          }}
                          className="p-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl shadow-xs"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className="font-black text-sm text-blue-800 bg-blue-100/90 px-3 py-1 rounded-full border border-blue-200">
                        {d.total_points} ★
                      </span>
                      <span className="text-xs text-slate-500 font-bold">History →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Passbook Modal (Mobile-First Card) */}
            {selectedDukandarDetails && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setSelectedDukandarDetails(null)}
              >
                <div
                  className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Digital Loyalty Passbook Header */}
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 sm:p-6 relative">
                    <button
                      onClick={() => setSelectedDukandarDetails(null)}
                      className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider">
                        Dukandar History
                      </span>
                    </div>

                    <h2 className="text-2xl font-black">{selectedDukandarDetails.name}</h2>
                    <p className="text-xs text-blue-100">{selectedDukandarDetails.phone}</p>

                    <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Total Balance</p>
                        <p className="text-3xl font-black mt-0.5">{selectedDukandarDetails.total_points} Points</p>
                      </div>

                      {/* Quick Call & WhatsApp on Passbook */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFollowUpClick('call', selectedDukandarDetails.phone)}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </button>
                        <button
                          onClick={() => handleFollowUpClick('whatsapp', selectedDukandarDetails.phone)}
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ledger Orders History */}
                  <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Orders & Points Ledger ({customerTransactions.length})
                    </h4>

                    {loadingHistory ? (
                      <div className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading ledger...
                      </div>
                    ) : customerTransactions.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                        No orders recorded yet.
                      </div>
                    ) : (
                      customerTransactions.map(o => (
                        <div
                          key={o.id}
                          className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                Cement: {o.bags_ordered} Bags
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                o.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {o.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(o.order_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {o.points_awarded > 0 && (
                              <span className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                                +{o.points_awarded} ★
                              </span>
                            )}
                            <button
                              onClick={() => handleResendWhatsApp(o, selectedDukandarDetails)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 flex items-center gap-1"
                              title="Resend WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3" />
                              Send
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
