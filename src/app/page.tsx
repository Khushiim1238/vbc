"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Check, User, Package, Ticket, FilePlus, Receipt, CheckCircle2, Clock, Trophy, Lock } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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

  const [activeTab, setActiveTab] = useState<'order' | 'transactions'>('order');
  
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
  const [enteredBy] = useState("Staff");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth check failed", err);
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

  async function fetchTransactions() {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, karigars(name, phone)")
        .order("order_time", { ascending: false })
        .limit(500);
        
      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      setLoadingTransactions(false);
    }
  }

  async function fetchKarigars() {
    try {
      const res = await fetch("/api/karigars");
      const data = await res.json();
      if (Array.isArray(data)) setKarigars(data);
    } catch (err) {
      console.error("Failed to fetch karigars:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateKarigar = async () => {
    if (!newKarigarName || !newKarigarPhone) return null;
    try {
      const res = await fetch("/api/karigars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKarigarName, phone: newKarigarPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create Karigar");
        return null;
      }
      setKarigars(prev => [...prev, data.karigar].sort((a, b) => a.name.localeCompare(b.name)));
      return { id: data.karigar.id, name: data.karigar.name };
    } catch (err) {
      console.error("Error creating karigar:", err);
      alert("Something went wrong creating the Karigar");
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetKarigarId = selectedKarigar;
    let targetCustomerName = selectedKarigarName;

    if (isNewCustomer) {
      const newKarigar = await handleCreateKarigar();
      if (!newKarigar) return;
      targetKarigarId = newKarigar.id;
      targetCustomerName = newKarigar.name;
    }

    if (!targetKarigarId) {
      alert("Please select or add a customer");
      return;
    }

    setSubmitting(true);
    setSuccess(null);

    const submittedBags = Number(bags) || 0;
    const submittedSariya = Number(sariya1) || 0;

    // Use live calculation or backend points
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
          points_awarded: calculatedCoupons // explicitly sending coupons if backend uses it, otherwise just passing
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

        // Clear fields
        setBags("");
        setSariya1("");
        setSelectedKarigar("");
        setSelectedKarigarName("");
        setNewKarigarName("");
        setNewKarigarPhone("");
        setSearchQuery("");
        setIsNewCustomer(false);
        fetchKarigars();

        // Do NOT auto-hide success; the user will click "Done" on the overlay modal
      } else {
        alert(data.error || "Failed to submit order");
      }
    } catch (err) {
      console.error("Error submitting order:", err);
      alert("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredKarigars = karigars.filter(k =>
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.phone.includes(searchQuery)
  );

  // Live total coupons calculation
  const bagsCount = Number(bags) || 0;
  const sariyaAmount = Number(sariya1) || 0;
  const liveCoupons = Math.floor(bagsCount / 100) + Math.floor(sariyaAmount / 100000);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 selection:bg-orange-100 selection:text-orange-900">
        <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-gray-100 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Staff Access</h2>
          <p className="text-gray-500 mb-8">Please enter the PIN to continue</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: passwordInput })
              });
              const data = await res.json();
              if (res.ok) {
                setIsAuthenticated(true);
              } else {
                alert(data.error || "Incorrect PIN");
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
              className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-50 border border-transparent rounded-2xl mb-6 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-mono"
              placeholder="••••"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-medium transition-all shadow-lg shadow-orange-600/20 active:scale-95"
            >
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-800 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Elegant Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Image
              src="/v_logo.png"
              alt="Vardhman Logo"
              width={100}
              height={40}
              className="object-contain"
            />
            <span className="font-semibold text-lg tracking-tight text-gray-900 leading-tight"> Daily <span className="text-orange-500 font-light">Orders</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full font-medium border border-orange-100">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            {enteredBy} Mode
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-6 lg:py-8 pb-24">
        
        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-200/60 rounded-xl w-full max-w-sm mb-6 mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'order' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Clock className="w-4 h-4" />
            Transactions
          </button>
        </div>

        {activeTab === 'order' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Success Overlay Modal */}
            {success && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Successful!</h2>
                  <p className="text-slate-600 mb-6">
                    <span className="font-semibold text-slate-900">{success.customerName}'s</span> order has been logged.
                  </p>
                  {success.coupons > 0 ? (
                    <div className="bg-emerald-50 w-full rounded-2xl p-4 mb-6 border border-emerald-100">
                      <p className="text-sm text-emerald-800 font-medium mb-1">Coupons Allotted</p>
                      <p className="text-3xl font-bold text-emerald-600 tracking-wider">
                        {formatCoupons(success.startCoupon, success.coupons)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 w-full rounded-2xl p-4 mb-6 border border-slate-100">
                      <p className="text-sm text-slate-800 font-medium mb-1">No coupon allotted</p>
                    </div>
                  )}
                  <button 
                    onClick={() => setSuccess(null)}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 text-center lg:text-left">
              <h1 className="text-4xl font-light tracking-tight text-gray-900 mb-3">Create New Order</h1>
              <p className="text-gray-500 text-lg">Log purchases elegantly and award points instantly.</p>
            </div>



            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Customer Details Card */}
              <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-sm rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                      <User className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-medium text-gray-900">Customer Details</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    className="text-sm text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors px-4 py-2 rounded-full font-medium flex items-center gap-2"
                  >
                    {isNewCustomer ? "Select Existing" : <><Plus className="w-4 h-4" /> Add New</>}
                  </button>
                </div>

                <div className="p-8">
                  {isNewCustomer ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 ml-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newKarigarName}
                          onChange={(e) => setNewKarigarName(e.target.value)}
                          className="w-full p-3.5 bg-gray-50 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                          placeholder="e.g. Rahul Sharma"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 ml-1">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={newKarigarPhone}
                          onChange={(e) => setNewKarigarPhone(e.target.value)}
                          className="w-full p-3.5 bg-gray-50 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                          placeholder="10-digit mobile"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 relative animate-in fade-in zoom-in-95 duration-200">
                      <label className="text-sm font-medium text-gray-700 ml-1">Search Existing Customer</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedKarigar("");
                            setSelectedKarigarName("");
                          }}
                          className="w-full p-3.5 pl-12 bg-gray-50 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-gray-900"
                          placeholder="Search by name or phone..."
                        />
                      </div>

                      {searchQuery && !selectedKarigar && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-orange-100 rounded-xl shadow-2xl shadow-orange-900/5 max-h-64 overflow-y-auto">
                          {loading ? (
                            <div className="p-4 text-sm text-gray-500 text-center">Loading...</div>
                          ) : filteredKarigars.length > 0 ? (
                            filteredKarigars.map((k) => (
                              <div
                                key={k.id}
                                onClick={() => {
                                  setSelectedKarigar(k.id);
                                  setSelectedKarigarName(k.name);
                                  setSearchQuery(`${k.name} (${k.phone})`);
                                }}
                                className="px-5 py-3.5 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors"
                              >
                                <span className="font-medium text-gray-900">{k.name}</span>
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{k.phone}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-sm text-gray-500 text-center">No customers found.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Card */}
              <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3 bg-white/50 backdrop-blur-sm rounded-t-3xl">
                  <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-medium text-gray-900">Order Items</h2>
                </div>

                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Cement */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 ml-1">Cement Bags</label>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={bags}
                          onChange={(e) => setBags(e.target.value ? parseInt(e.target.value) : "")}
                          className="w-full p-4 pl-5 bg-gray-50 border border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-xl font-light"
                          placeholder="0"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">Bags</span>
                      </div>
                    </div>

                    {/* Sariya */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 ml-1">Sariya (Rebar)</label>
                      </div>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={sariya1}
                          onChange={(e) => setSariya1(e.target.value ? parseFloat(e.target.value) : "")}
                          className="w-full p-4 pl-9 pr-5 bg-gray-50 border border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-xl font-light"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit & Live Calculation */}
              <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-6">

                <div className="flex items-center gap-4 bg-orange-50/80 px-6 py-4 rounded-2xl border border-orange-100/50 w-full md:w-auto">
                  <div className="bg-orange-100 p-2.5 rounded-xl">
                    <Ticket className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-orange-800 font-medium leading-none mb-1.5">Total Earned</p>
                    <p className="text-2xl font-semibold text-orange-900 leading-none">{liveCoupons} Coupons</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || (!selectedKarigar && !isNewCustomer) || (liveCoupons === 0 && bags === "" && sariya1 === "")}
                  className="w-full md:w-auto px-10 py-5 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-2xl font-medium transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-3 text-lg"
                >
                  {submitting ? "Processing Order..." : "Confirm & Submit Order"}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Transaction History</h2>
              <p className="text-slate-500 mt-1">Review past orders and their approval status.</p>
            </div>
            
            <div className="space-y-4">
              {loadingTransactions ? (
                <div className="text-center py-10 text-slate-500">Loading history...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-white rounded-3xl border border-slate-100">No transactions found.</div>
              ) : (
                transactions.map((t) => {
                  const isApproved = t.status === 'approved';
                  
                  return (
                    <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isApproved ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        {isApproved ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <Clock className="w-6 h-6 text-amber-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate text-lg">
                          {t.karigars?.name || 'Unknown Karigar'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(t.order_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(t.order_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-sm font-medium text-slate-600 mt-1.5 bg-slate-50 inline-block px-2 py-1 rounded-md">
                          {[
                            t.bags_ordered > 0 ? `${t.bags_ordered} bags` : null,
                            t.sariya_ordered > 0 ? `₹${t.sariya_ordered} sariya` : null
                          ].filter(Boolean).join(' & ')}
                        </p>
                      </div>

                      <div className="sm:text-right shrink-0 mt-3 sm:mt-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-extrabold text-sm ${isApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                            C-No: {formatCoupons(t.coupon_number, t.points_awarded)}
                          </span>
                          <Trophy className={`w-4 h-4 ${isApproved ? 'text-emerald-500' : 'text-slate-300'}`} />
                        </div>
                        <div className={`inline-block px-3 py-1 mt-0 sm:mt-1 rounded-full text-xs font-bold uppercase tracking-wider ${isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {isApproved ? 'Approved' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
