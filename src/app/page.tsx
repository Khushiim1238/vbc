"use client";

import { useState, useEffect } from "react";
import { 
  Search, Plus, User, Package, Ticket, CheckCircle2, Clock, 
  Lock, Users, XCircle, Loader2, Phone, MessageCircle, 
  ChevronRight, RefreshCw, X, Wallet, ShieldCheck, ArrowRight, Edit2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Karigar {
  id: string;
  name: string;
  phone: string;
  total_points: number;
}

interface Transaction {
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

export default function OrderEntry() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [activeTab, setActiveTab] = useState<'order' | 'transactions' | 'customer_history'>('order');
  
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success state with detailed info
  const [success, setSuccess] = useState<{
    customerName: string;
    bags: number;
    sariyaAmount: number;
    coupons: number;
    startCoupon?: number;
  } | null>(null);

  // Form State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKarigar, setSelectedKarigar] = useState("");
  const [selectedKarigarName, setSelectedKarigarName] = useState("");

  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newKarigarName, setNewKarigarName] = useState("");
  const [newKarigarPhone, setNewKarigarPhone] = useState("");

  const [bags, setBags] = useState<number | "">("");
  const [sariya1, setSariya1] = useState<number | "">(""); // Sariya in Rs
  const [enteredBy, setEnteredBy] = useState("Staff");
  const [staffNameInput, setStaffNameInput] = useState("");
  
  // Directory & Passbook State
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedKarigarDetails, setSelectedKarigarDetails] = useState<Karigar | null>(null);
  const [karigarHistory, setKarigarHistory] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const [editingKarigarId, setEditingKarigarId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedName = getStoredStaffName();
        if (savedName && savedName !== 'Staff' && savedName !== 'Admin') {
          setStaffNameInput(savedName);
        }

        // 24-hour validity check
        const authTimestamp = localStorage.getItem("vbc_karigar_auth_time");
        const is24HrValid = authTimestamp && (Date.now() - Number(authTimestamp)) < 24 * 60 * 60 * 1000;

        if (!is24HrValid) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/me?portal=karigar');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          const activeRoleName = getStoredStaffName(data.role);
          setEnteredBy(activeRoleName);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
    fetchKarigars();
  }, []);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [activeTab]);

  async function fetchKarigars() {
    try {
      const res = await fetch("/api/karigars");
      if (res.ok) {
        const data = await res.json();
        setKarigars(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchTransactions() {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, karigars(name, phone)')
        .order('order_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNameInput.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!passwordInput.trim()) {
      toast.error("Please enter your staff PIN");
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        const trimmedName = staffNameInput.trim();
        localStorage.setItem("vbc_staff_name", trimmedName);
        localStorage.setItem("vbc_karigar_auth_time", Date.now().toString());
        setEnteredBy(trimmedName);
        setIsAuthenticated(true);
        fetchKarigars();
        toast.success(`Welcome back, ${trimmedName}!`);
      } else {
        toast.error(data.error || "Invalid PIN");
        setPasswordInput("");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleFollowUpClick = (e: React.MouseEvent, type: 'call' | 'whatsapp', phone: string) => {
    e.stopPropagation();
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (type === 'call') {
      window.open(`tel:+${cleanPhone}`, '_self');
    } else {
      const msg = `नमस्ते जी! वर्धमान बिल्डिंग सेंटर से संपर्क करने के लिए धन्यवाद।`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleKarigarClick = async (karigar: Karigar) => {
    setSelectedKarigarDetails(karigar);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('karigar_id', karigar.id)
        .order('order_time', { ascending: false });

      if (error) throw error;
      setKarigarHistory(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveKarigar = async (id: string) => {
    try {
      const cleanPhone = editPhone.trim().replace(/\D/g, '');
      if (!editName.trim()) {
        toast.error("Please enter a valid customer name");
        return;
      }
      if (cleanPhone.length < 10) {
        toast.error("Please enter a valid 10-digit phone number");
        return;
      }

      const res = await fetch(`/api/karigars/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), phone: cleanPhone })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Customer updated successfully");
        setKarigars(prev => prev.map(k => k.id === id ? { ...k, name: editName.trim(), phone: cleanPhone } : k));
        if (selectedKarigarDetails?.id === id) {
          setSelectedKarigarDetails({ ...selectedKarigarDetails, name: editName.trim(), phone: cleanPhone });
        }
        setTransactions(prev => prev.map(t => t.karigar_id === id ? {
          ...t,
          karigars: { name: editName.trim(), phone: cleanPhone }
        } : t));
        setEditingKarigarId(null);
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleDeleteKarigar = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer? All their order history will be deleted.")) return;
    try {
      const res = await fetch(`/api/karigars/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Customer deleted");
        setKarigars(karigars.filter(k => k.id !== id));
        setSelectedKarigarDetails(null);
      } else {
        toast.error("Delete failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleResendWhatsApp = (order: Transaction, karigar: Karigar) => {
    let orderDetails = "";
    if (order.bags_ordered > 0 && order.sariya_ordered > 0) {
      orderDetails = `सीमेंट: ${order.bags_ordered} बैग, सरिया: ₹${order.sariya_ordered}`;
    } else if (order.bags_ordered > 0) {
      orderDetails = `सीमेंट: ${order.bags_ordered} बैग`;
    } else if (order.sariya_ordered > 0) {
      orderDetails = `सरिया: ₹${order.sariya_ordered}`;
    }

    let msg = `नमस्ते ${karigar.name} जी! 🙏\n\n`;
    if (orderDetails) {
      msg += `✅ *ऑर्डर विवरण:* ${orderDetails}\n`;
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

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Live Coupon Calculation: 100 bags = 1 coupon, ₹1,00,000 sariya = 1 coupon
  const bagsNum = typeof bags === "number" ? bags : 0;
  const sariyaNum = typeof sariya1 === "number" ? sariya1 : 0;
  const liveCoupons = Math.floor(bagsNum / 100) + Math.floor(sariyaNum / 100000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetKarigarId = selectedKarigar;
    let targetCustomerName = selectedKarigarName;

    if (isNewCustomer) {
      if (!newKarigarName.trim() || !newKarigarPhone.trim()) {
        toast.error("Please provide both name and phone number");
        return;
      }

      const cleanPhone = newKarigarPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        toast.error("Please enter a valid 10-digit phone number");
        return;
      }

      setSubmitting(true);
      try {
        const createRes = await fetch("/api/karigars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newKarigarName.trim(),
            phone: cleanPhone,
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok || !createData.success) {
          toast.error(createData.error || "Failed to create customer");
          setSubmitting(false);
          return;
        }

        targetKarigarId = createData.karigar.id;
        targetCustomerName = createData.karigar.name;
      } catch (err) {
        console.error(err);
        toast.error("Network error while creating customer");
        setSubmitting(false);
        return;
      }
    }

    if (!targetKarigarId) {
      toast.error("Please select or add a customer");
      return;
    }

    setSubmitting(true);
    setSuccess(null);

    const submittedBags = Number(bags) || 0;
    const submittedSariya = Number(sariya1) || 0;
    const calculatedCoupons = Math.floor(submittedBags / 100) + Math.floor(submittedSariya / 100000);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karigar_id: targetKarigarId,
          bags_ordered: submittedBags,
          sariya_ordered: submittedSariya,
          entered_by: enteredBy,
          points_awarded: calculatedCoupons
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({
          customerName: targetCustomerName,
          bags: submittedBags,
          sariyaAmount: submittedSariya,
          coupons: data.order?.points_awarded ?? calculatedCoupons,
          startCoupon: data.order?.coupon_number
        });

        setBags("");
        setSariya1("");
        setSelectedKarigar("");
        setSelectedKarigarName("");
        setNewKarigarName("");
        setNewKarigarPhone("");
        setSearchQuery("");
        setIsNewCustomer(false);
        fetchKarigars();
      } else {
        toast.error(data.error || "Failed to submit order");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCoupons = (start: number | null | undefined, count: number) => {
    if (!start) return count.toString();
    if (count === 1) return start.toString();
    if (count > 3) return `${start} to ${start + count - 1}`;
    const arr = [];
    for(let i=0; i<count; i++) arr.push(start + i);
    return arr.join(", ");
  };

  const filteredKarigars = karigars.filter(k => 
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    k.phone.includes(searchQuery)
  );

  const filteredDirectoryKarigars = karigars.filter(k => 
    k.name.toLowerCase().includes(directorySearch.toLowerCase()) || 
    k.phone.includes(directorySearch)
  );

  // Authentication Screen
  // Authentication Screen (Light Theme)
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200/80 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-center mb-5">
            <Image
              src="/v_logo.png"
              alt="Vardhman Logo"
              width={96}
              height={38}
              className="object-contain"
            />
          </div>
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-100 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">Staff Portal</h2>
          <p className="text-slate-500 text-xs font-medium mb-6">Enter your name and PIN to log in</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-left mb-1.5 pl-1">
                Your Name
              </label>
              <input
                type="text"
                value={staffNameInput}
                onChange={(e) => setStaffNameInput(e.target.value)}
                className="w-full text-center text-base p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner placeholder:text-slate-400 placeholder:font-normal"
                placeholder="e.g. Ramraj"
                required
                autoFocus={!staffNameInput}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-left mb-1.5 pl-1">
                Staff PIN
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full text-center text-3xl tracking-[0.5em] p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner placeholder:tracking-normal placeholder:text-slate-300"
                placeholder="••••"
                required
                autoFocus={!!staffNameInput}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/25 cursor-pointer mt-2"
            >
              Unlock Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-orange-100 selection:text-orange-900 pb-16">
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
              Daily Orders
            </div>
          </div>

          {/* Portal Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200/80 shadow-xs">
            <span>🔨</span>
            <span>Karigar Portal</span>
          </div>

          {/* Staff Badge */}
          <button
            type="button"
            onClick={handleStaffBadgeClick}
            title="Tap to change staff name"
            className="flex items-center gap-1.5 text-xs bg-orange-50 text-orange-800 px-2.5 py-1 rounded-full font-semibold border border-orange-200/60 shrink-0 hover:bg-orange-100 active:scale-95 transition-all cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
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
                ? 'bg-white text-orange-600 shadow-sm' 
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
                ? 'bg-white text-orange-600 shadow-sm' 
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
                ? 'bg-white text-orange-600 shadow-sm' 
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
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-1">Order Logged!</h2>
                  <p className="text-slate-600 text-xs sm:text-sm mb-5">
                    Order for <span className="font-bold text-slate-900">{success.customerName}</span> has been submitted.
                  </p>

                  {success.coupons > 0 ? (
                    <div className="bg-orange-50 w-full rounded-2xl p-4 mb-5 border border-orange-200/80">
                      <p className="text-xs text-orange-800 font-bold uppercase tracking-wider mb-1">Coupons Allotted</p>
                      <p className="text-3xl font-black text-orange-600 tracking-wider">
                        {formatCoupons(success.startCoupon, success.coupons)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {success.bags > 0 ? `${success.bags} bags` : ''} 
                        {success.sariyaAmount > 0 ? ` • ₹${success.sariyaAmount} sariya` : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 w-full rounded-2xl p-3.5 mb-5 border border-slate-200 text-xs text-slate-600 font-medium">
                      Order logged (No coupons threshold reached yet)
                    </div>
                  )}

                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2 mb-5 w-full">
                    ⏳ Coupouns will be credited upon Admin approval.
                  </p>

                  <button
                    onClick={() => setSuccess(null)}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-xl font-bold shadow-lg shadow-orange-600/25 transition-all text-sm"
                  >
                    Done (Log Next Order)
                  </button>
                </div>
              </div>
            )}

            {/* Order Card Container */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 1. Customer Selection Card */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Customer Details</h3>
                      <p className="text-[11px] text-slate-500">Select or add a Karigar</p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(false)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        !isNewCustomer ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(true)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        isNewCustomer ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      + New
                    </button>
                  </div>
                </div>

                {!isNewCustomer ? (
                  <div className="space-y-2">
                    {/* Selected Banner */}
                    {selectedKarigar ? (
                      <div className="p-3.5 bg-orange-50/90 border border-orange-200 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                            {selectedKarigarName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{selectedKarigarName}</p>
                            <p className="text-xs text-orange-700 mt-0.5">
                              {karigars.find(k => k.id === selectedKarigar)?.phone} • {karigars.find(k => k.id === selectedKarigar)?.total_points || 0} Coupons
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKarigar("");
                            setSelectedKarigarName("");
                            setSearchQuery("");
                          }}
                          className="text-xs font-bold text-orange-600 hover:text-orange-800 bg-white px-2.5 py-1.5 rounded-xl border border-orange-200 shadow-sm"
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
                            placeholder="Search karigar by name or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-9 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all font-medium"
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
                        {searchQuery && !selectedKarigar && (
                          <div className="mt-2 max-h-56 overflow-y-auto border border-orange-100 rounded-2xl bg-white shadow-xl divide-y divide-slate-100 animate-in fade-in duration-150">
                            {filteredKarigars.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                No karigar found. Click <strong>"+ New"</strong> above to register.
                              </div>
                            ) : (
                              filteredKarigars.map((k) => (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedKarigar(k.id);
                                    setSelectedKarigarName(k.name);
                                    setSearchQuery("");
                                  }}
                                  className="w-full p-3 text-left hover:bg-orange-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                                      {k.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 text-sm">{k.name}</p>
                                      <p className="text-slate-400">{k.phone}</p>
                                    </div>
                                  </div>
                                  <span className="font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 shrink-0">
                                    {k.total_points} ⭐
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
                      <label className="block text-xs font-bold text-slate-600 mb-1">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={newKarigarName}
                        onChange={(e) => setNewKarigarName(e.target.value)}
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Number (10 digits) *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="e.g. 9876543210"
                        value={newKarigarPhone}
                        onChange={(e) => setNewKarigarPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Order Quantities Card */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Order Items</h3>
                    <p className="text-[11px] text-slate-500">100 Bags or ₹1,00,000 Sariya = 1 Coupon</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Cement Bags */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Cement Bags (सीमेंट बोरी)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={bags}
                        onChange={(e) => setBags(e.target.value ? parseInt(e.target.value) : "")}
                        className="w-full pl-4 pr-14 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 transition-all font-mono"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase select-none">
                        Bags
                      </span>
                    </div>
                  </div>

                  {/* Sariya in Rs */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Sariya Amount (सरिया ₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400 select-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={sariya1}
                        onChange={(e) => setSariya1(e.target.value ? parseFloat(e.target.value) : "")}
                        className="w-full pl-8 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:bg-white focus:border-orange-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Coupon Award Banner */}
                <div className="p-3.5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-sm">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-orange-950 uppercase tracking-wider">Coupons Earned</p>
                      <p className="text-lg font-black text-orange-600 leading-tight">
                        {liveCoupons} Coupons
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    Live Calc
                  </span>
                </div>
              </div>

              {/* 3. Action Submit Button */}
              <button
                type="submit"
                disabled={submitting || (!selectedKarigar && !isNewCustomer) || (liveCoupons === 0 && bags === "" && sariya1 === "")}
                className="w-full h-14 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-orange-600/25 active:scale-[0.98] flex items-center justify-center gap-2"
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
                <h3 className="font-bold text-slate-900 text-sm">Recent Orders</h3>
                <p className="text-xs text-slate-400">Review status and points</p>
              </div>
              <button
                onClick={fetchTransactions}
                disabled={loadingTransactions}
                className="text-xs font-bold text-orange-600 hover:text-orange-800 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loadingTransactions ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-orange-500" />
                Loading orders...
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200 text-xs">
                No transactions logged yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {transactions.map((t) => {
                  const isApproved = t.status === 'approved';
                  const isCancelled = t.status === 'cancelled';
                  
                  return (
                    <div
                      key={t.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-200 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                          isApproved ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isApproved ? '✓' : isCancelled ? '✕' : '⏳'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{t.karigars?.name || 'Customer'}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isApproved ? 'bg-emerald-100 text-emerald-800' : isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t.karigars?.phone} • {new Date(t.order_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                            {[
                              t.bags_ordered ? `${t.bags_ordered} bags` : null,
                              t.sariya_ordered ? `₹${t.sariya_ordered}` : null
                            ].filter(Boolean).join(' • ') || 'Order'}
                          </span>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 px-3 py-1 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-orange-700 uppercase">Coupons</p>
                          <p className="text-sm font-black text-orange-600">
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

        {/* TAB 3: CUSTOMER HISTORY / PASSBOOK */}
        {activeTab === 'customer_history' && (
          <div className="space-y-3.5 animate-in fade-in duration-200 pb-10">
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-sm flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Search customer by name or phone..." 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium transition-all"
                />
                {directorySearch && (
                  <button
                    type="button"
                    onClick={() => setDirectorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {directorySearch && (
                <button
                  type="button"
                  onClick={() => setDirectorySearch('')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5"
                >
                  Clear
                </button>
              )}
            </div>

            {/* List Header Info */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-600">
                {filteredDirectoryKarigars.length} {filteredDirectoryKarigars.length === 1 ? 'Customer' : 'Customers'}
              </p>
              <p className="text-[11px] text-slate-400">Tap to view history</p>
            </div>

            {/* Customer List (Full natural mobile layout, no max-h truncation) */}
            {filteredDirectoryKarigars.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200 shadow-sm text-xs">
                No customers found matching &quot;{directorySearch}&quot;
              </div>
            ) : (
              <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                {filteredDirectoryKarigars.map((k) => (
                  <div
                    key={k.id}
                    onClick={() => handleKarigarClick(k)}
                    className="p-3.5 bg-white hover:bg-orange-50/60 active:scale-[0.99] border border-slate-200/90 hover:border-orange-300 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-base leading-snug">{k.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{k.phone}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={(e) => handleFollowUpClick(e, 'call', k.phone)}
                          className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl shadow-xs"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleFollowUpClick(e, 'whatsapp', k.phone)}
                          className="p-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl shadow-xs"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKarigarClick(k);
                            setEditingKarigarId(k.id);
                            setEditName(k.name);
                            setEditPhone(k.phone);
                          }}
                          className="p-2 bg-slate-50 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 rounded-xl shadow-xs text-slate-700 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className="font-black text-sm text-orange-800 bg-orange-100/90 px-3 py-1 rounded-full border border-orange-200">
                        {k.total_points} ⭐
                      </span>
                      <span className="text-xs text-slate-500 font-bold">History →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Passbook Modal (Mobile-First Card) */}
            {selectedKarigarDetails && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setSelectedKarigarDetails(null)}
              >
                <div
                  className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Digital Loyalty Passbook Header */}
                  <div className="bg-gradient-to-br from-orange-600 to-amber-700 text-white p-5 sm:p-6 relative">
                    <button
                      onClick={() => setSelectedKarigarDetails(null)}
                      className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider">
                        Customer History
                      </span>
                    </div>

                    {editingKarigarId === selectedKarigarDetails.id ? (
                      <div className="space-y-3 bg-white/10 p-3.5 rounded-2xl border border-white/20 mt-1">
                        <div>
                          <label className="text-[11px] font-bold text-orange-200 uppercase tracking-wider block mb-1">Customer Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full p-2.5 bg-white text-slate-900 rounded-xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            placeholder="Customer Name"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-orange-200 uppercase tracking-wider block mb-1">Phone Number</label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full p-2.5 bg-white text-slate-900 rounded-xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            placeholder="10-digit Phone Number"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveKarigar(selectedKarigarDetails.id)}
                            className="flex-1 py-2 bg-white text-orange-700 hover:bg-orange-50 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKarigarId(null)}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-black">{selectedKarigarDetails.name}</h2>
                          <p className="text-xs text-orange-100 font-medium mt-0.5">{selectedKarigarDetails.phone}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKarigarId(selectedKarigarDetails.id);
                            setEditName(selectedKarigarDetails.name);
                            setEditPhone(selectedKarigarDetails.phone);
                          }}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95 cursor-pointer"
                          title="Edit Customer Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-orange-200 font-bold">Total Balance</p>
                        <p className="text-3xl font-black mt-0.5">{selectedKarigarDetails.total_points} Coupons</p>
                      </div>

                      {/* Quick Call & WhatsApp on Passbook */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleFollowUpClick(e, 'call', selectedKarigarDetails.phone)}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </button>
                        <button
                          onClick={(e) => handleFollowUpClick(e, 'whatsapp', selectedKarigarDetails.phone)}
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
                      Orders & Coupons Ledger ({karigarHistory.length})
                    </h4>

                    {loadingHistory ? (
                      <div className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                        Loading ledger...
                      </div>
                    ) : karigarHistory.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                        No orders recorded yet.
                      </div>
                    ) : (
                      karigarHistory.map(o => (
                        <div
                          key={o.id}
                          className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {[
                                  o.bags_ordered ? `${o.bags_ordered} bags` : null,
                                  o.sariya_ordered ? `₹${o.sariya_ordered}` : null
                                ].filter(Boolean).join(' • ') || 'Order'}
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
                              <span className="font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-200">
                                +{o.points_awarded} ⭐
                              </span>
                            )}
                            <button
                              onClick={() => handleResendWhatsApp(o, selectedKarigarDetails)}
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
