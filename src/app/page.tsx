"use client";

import { useState, useEffect } from "react";
import { Send, CheckCircle2, Loader2, Plus, Minus } from "lucide-react";

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
  const [success, setSuccess] = useState<{ bags: number; sariya: number; points: number } | null>(null);

  // Form State
  const [selectedKarigar, setSelectedKarigar] = useState("");
  const [bags, setBags] = useState<number | "">("");
  const [sariya, setSariya] = useState<number | "">("");
  const [enteredBy, setEnteredBy] = useState("Staff");

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
      if (!newId) return;
      targetKarigarId = newId;
    }

    if (!targetKarigarId || (bags === "" && sariya === "")) return;

    setSubmitting(true);
    setSuccess(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karigar_id: targetKarigarId,
          bags_ordered: bags || 0,
          sariya_ordered: sariya || 0,
          entered_by: enteredBy,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({ bags: Number(bags) || 0, sariya: Number(sariya) || 0, points: data.order.points_awarded });
        setBags("");
        setSariya("");
        setSelectedKarigar("");
        fetchKarigars();
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

  const activeKarigar = karigars.find(k => k.id === selectedKarigar);

  return (
    <main className="min-h-screen bg-[#F0EBF8] text-gray-800 font-sans py-8 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-3xl space-y-4">
        
        {success ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden border-t-8 border-t-yellow-400 p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-16 h-16 text-yellow-500 mb-4" />
              <h2 className="text-2xl font-medium text-gray-900 mb-2">Order Confirmed!</h2>
              <p className="text-gray-600 mb-6">Your response has been recorded.</p>
              
              <div className="w-full max-w-sm bg-yellow-50 rounded-md p-4 mb-6 border border-yellow-100 text-left">
                {success.bags > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Cement Bags:</span>
                    <span className="font-medium text-gray-900">{success.bags}</span>
                  </div>
                )}
                {success.sariya > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Sariya Amount:</span>
                    <span className="font-medium text-gray-900">{success.sariya}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-200">
                  <span className="text-gray-600">Points Awarded:</span>
                  <span className="font-medium text-yellow-600">+{success.points}</span>
                </div>
              </div>
              
              <button 
                onClick={() => setSuccess(null)}
                className="text-yellow-600 font-medium hover:underline focus:outline-none"
              >
                Submit another response
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden border-t-8 border-t-yellow-400 p-6 md:p-8">
              <h1 className="text-3xl font-medium text-gray-900 mb-3">Vardhaman Group - Entry</h1>
            </div>

            {/* Karigar Selection Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <h3 className="text-base font-medium text-gray-900 mb-4">
                Karigar Details <span className="text-red-600">*</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="karigarType" 
                      checked={!isNewKarigar} 
                      onChange={() => setIsNewKarigar(false)}
                      className="w-4 h-4 text-yellow-500 focus:ring-yellow-500 border-gray-300"
                    />
                    <span className="text-gray-700">Select Existing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="karigarType" 
                      checked={isNewKarigar} 
                      onChange={() => setIsNewKarigar(true)}
                      className="w-4 h-4 text-yellow-500 focus:ring-yellow-500 border-gray-300"
                    />
                    <span className="text-gray-700">Add New Karigar</span>
                  </label>
                </div>

                {isNewKarigar ? (
                  <div className="space-y-6 pl-6 border-l-2 border-yellow-200">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Name <span className="text-red-600">*</span></label>
                      <input
                        type="text"
                        value={newKarigarName}
                        onChange={(e) => setNewKarigarName(e.target.value)}
                        placeholder="Your answer"
                        className="w-full md:w-2/3 border-b border-gray-300 hover:border-gray-400 focus:border-yellow-500 focus:border-b-2 bg-transparent py-2 px-1 outline-none transition-colors"
                        required={isNewKarigar}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Phone Number <span className="text-red-600">*</span></label>
                      <input
                        type="tel"
                        value={newKarigarPhone}
                        onChange={(e) => setNewKarigarPhone(e.target.value)}
                        placeholder="Your answer"
                        pattern="[0-9]{10}"
                        className="w-full md:w-2/3 border-b border-gray-300 hover:border-gray-400 focus:border-yellow-500 focus:border-b-2 bg-transparent py-2 px-1 outline-none transition-colors"
                        required={isNewKarigar}
                      />
                      <p className="text-xs text-gray-500 mt-1">Must be a 10-digit number</p>
                    </div>
                  </div>
                ) : (
                  <div className="pl-6 border-l-2 border-yellow-200">
                    <select
                      value={selectedKarigar}
                      onChange={(e) => setSelectedKarigar(e.target.value)}
                      className="w-full md:w-2/3 border border-gray-300 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-700 bg-white"
                      required={!isNewKarigar}
                      disabled={loading}
                    >
                      <option value="" disabled>
                        {loading ? "Loading..." : "Choose"}
                      </option>
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} - {k.phone}
                        </option>
                      ))}
                    </select>

                    {activeKarigar && (
                      <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 inline-block">
                        Current Points: <span className="font-medium text-yellow-600">{activeKarigar.total_points}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Entry Details Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <h3 className="text-base font-medium text-gray-900 mb-2">
                Purchases <span className="text-red-600">*</span>
              </h3>
              <p className="text-sm text-gray-500 mb-6">Enter the quantity for at least one item.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Cement Bags</label>
                  <input 
                    type="number"
                    min="1"
                    value={bags}
                    onChange={(e) => setBags(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="e.g. 150"
                    className="w-full md:w-1/2 border-b border-gray-300 hover:border-gray-400 focus:border-yellow-500 focus:border-b-2 bg-transparent py-2 px-1 outline-none transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 point per 100 bags</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Sariya Amount</label>
                  <input 
                    type="number"
                    min="1"
                    value={sariya}
                    onChange={(e) => setSariya(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="e.g. 100000"
                    className="w-full md:w-1/2 border-b border-gray-300 hover:border-gray-400 focus:border-yellow-500 focus:border-b-2 bg-transparent py-2 px-1 outline-none transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 point per 1,00,000</p>
                </div>
              </div>
              
              {/* Live Calculation Summary */}
              {(bags !== "" || sariya !== "") && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-gray-700">Estimated Points:</span>
                    <span className="text-yellow-600 text-lg">
                      {Math.floor(Number(bags) / 100) + Math.floor(Number(sariya) / 100000)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-4 flex items-center justify-between">
              <button
                type="submit"
                disabled={submitting || creatingKarigar || loading || (!isNewKarigar && !selectedKarigar) || (bags === "" && sariya === "")}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 px-6 rounded text-sm transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                {submitting || creatingKarigar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Submit"
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </main>
  );
}
