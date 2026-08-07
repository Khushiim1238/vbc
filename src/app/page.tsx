"use client";

import { useState, useEffect } from "react";
import { Send, CheckCircle2, Loader2, HardHat, Building2, PackagePlus, Bell, Plus, X, Phone, User } from "lucide-react";

interface Karigar {
  id: string;
  name: string;
  phone: string;
  total_points: number;
}

export default function OrderEntry() {
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ bags: number; points: number } | null>(null);

  // Form State
  const [selectedKarigar, setSelectedKarigar] = useState("");
  const [bags, setBags] = useState("");
  const [enteredBy, setEnteredBy] = useState("Staff"); // Hardcoded for Phase 1

  // New Karigar State
  const [isNewKarigar, setIsNewKarigar] = useState(false);
  const [newKarigarName, setNewKarigarName] = useState("");
  const [newKarigarPhone, setNewKarigarPhone] = useState("");
  const [creatingKarigar, setCreatingKarigar] = useState(false);

  useEffect(() => {
    fetchKarigars();
  }, []);

  const fetchKarigars = async () => {
    try {
      const res = await fetch("/api/karigars");
      const data = await res.json();
      if (Array.isArray(data)) setKarigars(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKarigar = async () => {
    if (!newKarigarName || !newKarigarPhone) return null;
    setCreatingKarigar(true);
    
    try {
      const res = await fetch("/api/karigars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKarigarName,
          phone: newKarigarPhone,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to create Karigar");
        setCreatingKarigar(false);
        return null;
      }
      
      // Add to list and select it
      setKarigars(prev => [...prev, data.karigar].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedKarigar(data.karigar.id);
      setIsNewKarigar(false);
      setNewKarigarName("");
      setNewKarigarPhone("");
      setCreatingKarigar(false);
      return data.karigar.id;
    } catch (err) {
      alert("Something went wrong creating the Karigar");
      setCreatingKarigar(false);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetKarigarId = selectedKarigar;
    
    if (isNewKarigar) {
      const newId = await handleCreateKarigar();
      if (!newId) return; // Error happened, stop submission
      targetKarigarId = newId;
    }

    if (!targetKarigarId || !bags) return;

    setSubmitting(true);
    setSuccess(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karigar_id: targetKarigarId,
          bags_ordered: parseInt(bags),
          entered_by: enteredBy,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({ bags: parseInt(bags), points: data.order.points_awarded });
        setBags("");
        setSelectedKarigar("");
        
        // Refresh karigars list in background to get updated points
        fetchKarigars();
        
        // Auto dismiss success after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        alert(data.error || "Failed to submit order");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 lg:p-12 relative overflow-hidden bg-slate-950">
      
      {/* Dynamic Background Effects for entire page */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden relative z-10">
        
        {/* Subtle top highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/30 to-transparent z-20" />

        {/* Left Side: Branding / Info */}
        <div className="md:w-5/12 lg:w-1/2 p-8 md:p-10 lg:p-14 flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-b md:border-b-0 md:border-r border-white/5">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-sky-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 mb-8 shadow-[0_0_40px_rgba(56,189,248,0.15)]">
              <Building2 className="w-10 h-10 md:w-12 md:h-12 text-sky-400" />
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              Vardhaman<br className="hidden lg:block" /> Group
            </h1>
            <p className="text-sky-300/80 text-lg md:text-xl font-medium mb-10">Karigar Reward System</p>
            
            {/* Feature list - hidden on very small mobile, visible otherwise */}
            <div className="hidden sm:flex flex-col space-y-5">
              <div className="flex items-center gap-4 text-slate-300 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700 group-hover:border-emerald-500/50 transition-colors shadow-inner">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Instant Rewards</h3>
                  <p className="text-sm text-slate-400">Points calculated automatically</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-slate-300 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700 group-hover:border-sky-500/50 transition-colors shadow-inner">
                  <Bell className="w-6 h-6 text-sky-400 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">WhatsApp Alerts</h3>
                  <p className="text-sm text-slate-400">Real-time notifications sent</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-7/12 lg:w-1/2 p-8 md:p-10 lg:p-14 bg-slate-900/60 flex flex-col justify-center relative">
          
          {success ? (
            <div className="text-center py-10 animate-in fade-in zoom-in duration-300">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 mb-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Order Logged!</h2>
              <p className="text-slate-400 mb-8 max-w-xs mx-auto">
                The order has been successfully recorded in the system.
              </p>
              
              <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/50 inline-block mb-8 w-full max-w-sm shadow-inner">
                <div className="grid grid-cols-2 gap-4 divide-x divide-slate-700/50">
                  <div>
                    <p className="text-slate-400 text-sm mb-1 font-medium">Recorded</p>
                    <p className="text-2xl font-bold text-white">{success.bags} <span className="text-indigo-400 text-lg">Bags</span></p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1 font-medium">Awarded</p>
                    <p className="text-2xl font-bold text-emerald-400">+{success.points} <span className="text-emerald-500/70 text-lg">Pts</span></p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setSuccess(null)}
                className="block w-full py-4 px-4 rounded-2xl text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all font-semibold"
              >
                Log Another Order
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">New Entry</h2>
                  <p className="text-slate-400">Enter order details to award points.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Karigar Selection/Creation Toggle */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-semibold text-slate-300">
                      {isNewKarigar ? "New Karigar Details" : "Select Karigar"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsNewKarigar(!isNewKarigar)}
                      className="text-xs flex items-center gap-1 font-medium text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-2 py-1 rounded-md"
                    >
                      {isNewKarigar ? (
                        <>
                          <X className="w-3 h-3" /> Cancel
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" /> Add New
                        </>
                      )}
                    </button>
                  </div>

                  {isNewKarigar ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-sky-400 group-focus-within:text-sky-300 transition-colors" />
                        </div>
                        <input
                          type="text"
                          value={newKarigarName}
                          onChange={(e) => setNewKarigarName(e.target.value)}
                          placeholder="Karigar Name"
                          className="block w-full pl-12 pr-4 py-4 bg-slate-800/70 border border-slate-700/70 rounded-2xl text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-slate-800 transition-all outline-none shadow-inner"
                          required={isNewKarigar}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-sky-400 group-focus-within:text-sky-300 transition-colors" />
                        </div>
                        <input
                          type="tel"
                          value={newKarigarPhone}
                          onChange={(e) => setNewKarigarPhone(e.target.value)}
                          placeholder="Phone Number (10 digits)"
                          pattern="[0-9]{10}"
                          title="10 digit mobile number"
                          className="block w-full pl-12 pr-4 py-4 bg-slate-800/70 border border-slate-700/70 rounded-2xl text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-slate-800 transition-all outline-none shadow-inner"
                          required={isNewKarigar}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative group animate-in fade-in duration-200">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <HardHat className="h-5 w-5 text-sky-400 group-focus-within:text-sky-300 transition-colors" />
                      </div>
                      <select
                        value={selectedKarigar}
                        onChange={(e) => setSelectedKarigar(e.target.value)}
                        className="block w-full pl-12 pr-10 py-4 bg-slate-800/70 border border-slate-700/70 rounded-2xl text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-slate-800 transition-all appearance-none outline-none shadow-inner"
                        required={!isNewKarigar}
                        disabled={loading}
                      >
                        <option value="" disabled>
                          {loading ? "Loading Karigars..." : "Choose a Karigar..."}
                        </option>
                        {karigars.map((k) => (
                          <option key={k.id} value={k.id} className="bg-slate-800 text-white">
                            {k.name} ({k.phone}) • {k.total_points} ⭐
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bags Input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">
                    Number of Bags
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <PackagePlus className="h-5 w-5 text-indigo-400 group-focus-within:text-indigo-300 transition-colors" />
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={bags}
                      onChange={(e) => setBags(e.target.value)}
                      placeholder="e.g. 150"
                      className="block w-full pl-12 pr-4 py-4 bg-slate-800/70 border border-slate-700/70 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-slate-800 transition-all outline-none font-medium text-lg shadow-inner"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || creatingKarigar || loading || (!isNewKarigar && !selectedKarigar) || !bags}
                  className="group mt-2 relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
                >
                  {submitting || creatingKarigar ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {creatingKarigar ? "Creating Karigar..." : "Recording Order..."}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-base">
                      <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      Submit Order
                    </span>
                  )}
                </button>

              </form>
              
              {/* Footer info */}
              <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-between items-center text-xs">
                <span className="text-slate-500">Secure Entry System</span>
                <span className="text-slate-500">
                  User: <span className="font-semibold text-slate-300">{enteredBy}</span>
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </main>
  );
}
