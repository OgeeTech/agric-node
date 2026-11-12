"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Phone,
  ShieldCheck,
  Truck,
  RefreshCw,
  Sprout,
  CheckCircle2,
  Lock,
  BadgeCheck,
  MapPin,
  CreditCard,
  X,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Listing {
  _id: string;
  cropType: string;
  quantity: number;
  price: number;
  areaCouncil: string;
  status: string;
  farmerId?: {
    name: string;
    phoneNumber: string;
    areaCouncil: string;
    nin: string;
    isRegistered: boolean;
  };
  createdAt: string;
}

interface Order {
  _id: string;
  amountPaid: number;
  paymentReference: string;
  buyerEmail: string;
  paymentStatus: "pending_payment" | "held_in_escrow" | "released" | "refunded";
  deliveryStatus:
    | "awaiting_payment"
    | "pending_dispatch"
    | "in_transit"
    | "delivered";
  listingId?: {
    cropType: string;
    quantity: number;
    areaCouncil: string;
    farmerId?: {
      name: string;
      phoneNumber: string;
      walletBalance: number;
      escrowBalance: number;
    };
  };
  buyerId?: {
    name: string;
  };
  createdAt: string;
}

export default function AgriNodeDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<string | null>(null);

  // Checkout Modal State
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyerName, setBuyerName] = useState("Abuja Agro Wholesalers");
  const [buyerEmail, setBuyerEmail] = useState("procurement@abujaagro.ng");
  const [buyerPhone, setBuyerPhone] = useState("+2348099999999");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // USSD Simulator State
  const [farmerPhone, setFarmerPhone] = useState("+2348011223344");
  const [ussdSessionActive, setUssdSessionActive] = useState(false);
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);
  const [ussdInput, setUssdInput] = useState("");
  const [ussdScreenText, setUssdScreenText] = useState(
    "Dial *384*100# to Register (Name, Area Council, NIN) or List Crops.",
  );
  const [ussdLoading, setUssdLoading] = useState(false);

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    try {
      const [listingsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/listings`),
        fetch(`${API_BASE}/orders`),
      ]);
      const listingsJson = await listingsRes.json();
      const ordersJson = await ordersRes.json();
      if (listingsJson.data) setListings(listingsJson.data);
      if (ordersJson.data) setOrders(ordersJson.data);
    } catch (err) {
      console.error("Failed to fetch market data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically verify Paystack payment when redirected back with ?reference=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");

    if (reference) {
      setPaymentBanner(`Verifying Paystack payment (${reference})...`);
      fetch(`${API_BASE}/orders/verify/${reference}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") {
            setPaymentBanner(
              `Payment verified! Funds are now locked in Escrow (${reference}).`,
            );
          } else {
            setPaymentBanner(`Verification warning: ${data.message}`);
          }
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
          fetchMarketData();
        })
        .catch(() => setPaymentBanner("Could not verify payment reference."));
    } else {
      fetchMarketData();
    }
  }, [fetchMarketData]);

  // USSD Request Handler
  const sendUssdPayload = async (newHistory: string[]) => {
    setUssdLoading(true);
    try {
      const body = new URLSearchParams({
        sessionId: "sim-session-01",
        serviceCode: "*384*100#",
        phoneNumber: farmerPhone,
        text: newHistory.join("*"),
      });

      const res = await fetch(`${API_BASE}/ussd`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const responseText = await res.text();
      const isContinue = responseText.startsWith("CON ");
      const cleanText = responseText.replace(/^(CON|END)\s+/, "");

      setUssdScreenText(cleanText);
      setUssdSessionActive(isContinue);

      if (!isContinue) {
        setUssdHistory([]);
        fetchMarketData();
      }
    } catch {
      setUssdScreenText(
        "Connection error: Ensure backend is running on port 8000.",
      );
      setUssdSessionActive(false);
    } finally {
      setUssdLoading(false);
    }
  };

  const handleDialUssd = () => {
    setUssdHistory([]);
    setUssdInput("");
    sendUssdPayload([]);
  };

  const handleUssdReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ussdInput.trim()) return;
    const updatedHistory = [...ussdHistory, ussdInput.trim()];
    setUssdHistory(updatedHistory);
    setUssdInput("");
    sendUssdPayload(updatedHistory);
  };

  // Initialize Real Paystack Checkout
  const handleInitiatePaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    setCheckoutLoading(true);

    try {
      const res = await fetch(`${API_BASE}/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selectedListing._id,
          buyerName,
          buyerEmail,
          buyerPhone,
        }),
      });

      const result = await res.json();
      if (res.ok && result.data?.authorizationUrl) {
        // Redirect browser to official Paystack Checkout page
        window.location.href = result.data.authorizationUrl;
      } else {
        alert(
          result.message ||
            "Failed to initialize Paystack transaction. Check PAYSTACK_SECRET_KEY in .env",
        );
      }
    } catch (error) {
      console.error("Paystack error:", error);
      alert("Network error initializing payment.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Confirm Delivery & Release Escrow
  const handleConfirmDelivery = async (orderId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orders/${orderId}/confirm-delivery`,
        {
          method: "PATCH",
        },
      );
      if (res.ok) fetchMarketData();
    } catch (error) {
      console.error("Confirm delivery error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between pb-6 mb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sprout className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              AgriNode{" "}
              <span className="text-emerald-400 font-normal text-lg">
                | NIN-Verified USSD & Paystack Escrow
              </span>
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            KYC-verified rural smallholder marketplace across the 6 FCT Area
            Councils.
          </p>
        </div>

        <button
          onClick={fetchMarketData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-medium transition"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`}
          />
          Refresh Ledger
        </button>
      </header>

      {/* Paystack Verification Notification Banner */}
      {paymentBanner && (
        <div className="max-w-7xl mx-auto mb-6 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <span>{paymentBanner}</span>
          <button
            onClick={() => setPaymentBanner(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: USSD KYC & LISTING TERMINAL */}
        <section className="lg:col-span-4 flex flex-col items-center">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> USSD GSM Terminal
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                *384*100#
              </span>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">
                Farmer Phone Number (Change to test new user)
              </label>
              <input
                type="text"
                value={farmerPhone}
                onChange={(e) => setFarmerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 font-mono"
              />
            </div>

            {/* Nokia-style LCD Screen */}
            <div className="bg-[#9bbc0f] text-slate-950 font-mono p-4 rounded-xl min-h-[210px] flex flex-col justify-between shadow-inner border-4 border-slate-800">
              <div className="text-[11px] font-bold border-b border-slate-950/20 pb-1 flex justify-between">
                <span>FCT AGRINODE</span>
                <span>2G USSD</span>
              </div>

              <div className="my-3 whitespace-pre-line text-xs font-bold leading-relaxed">
                {ussdLoading ? "Connecting to USSD gateway..." : ussdScreenText}
              </div>

              <div className="text-[10px] opacity-75 text-right">
                {ussdSessionActive
                  ? "CON (Waiting for input)"
                  : "END (Session closed)"}
              </div>
            </div>

            {ussdSessionActive ? (
              <form onSubmit={handleUssdReply} className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Reply option / NIN / value..."
                  value={ussdInput}
                  onChange={(e) => setUssdInput(e.target.value)}
                  autoFocus
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Send
                </button>
              </form>
            ) : (
              <button
                onClick={handleDialUssd}
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Phone className="w-4 h-4" /> Dial *384*100#
              </button>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: MARKETPLACE & PAYSTACK ESCROW LEDGER */}
        <section className="lg:col-span-8 space-y-8">
          {/* Crop Marketplace */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Verified FCT Farmer Listings
                </h2>
                <p className="text-xs text-slate-400">
                  Every farmer below is registered with their Area Council and
                  11-digit NIN
                </p>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1 rounded-full font-medium">
                {listings.length} Live Lots
              </span>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-400 text-sm">
                No verified listings yet. Dial *384*100# on the left to register
                a farmer and list a crop!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((item) => (
                  <div
                    key={item._id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-white">
                          {item.quantity}kg {item.cropType}
                        </span>
                        <span className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />{" "}
                          {item.areaCouncil}
                        </span>
                      </div>

                      <p className="text-2xl font-extrabold text-emerald-400 mt-2">
                        NGN {item.price.toLocaleString()}
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-900 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>
                            Farmer:{" "}
                            <strong className="text-slate-200">
                              {item.farmerId?.name}
                            </strong>
                          </span>
                          {item.farmerId?.nin && (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <BadgeCheck className="w-3.5 h-3.5" /> NIN
                              Verified
                            </span>
                          )}
                        </div>
                        <p>
                          Tel:{" "}
                          <span className="font-mono text-slate-300">
                            {item.farmerId?.phoneNumber}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedListing(item)}
                      className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Fund Escrow via
                      Paystack
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Escrow Orders Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" /> Paystack
                Escrow & Settlement Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Tracks Paystack payment references, locked farmer escrow
                balances, and final settlements
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-400 text-sm">
                No escrow transactions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {order.listingId?.quantity}kg{" "}
                          {order.listingId?.cropType}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Ref: {order.paymentReference}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                            order.paymentStatus === "held_in_escrow"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : order.paymentStatus === "released"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {order.paymentStatus.toUpperCase().replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Amount:{" "}
                        <strong className="text-slate-200">
                          NGN {order.amountPaid.toLocaleString()}
                        </strong>{" "}
                        • Farmer:{" "}
                        <strong className="text-slate-200">
                          {order.listingId?.farmerId?.name}
                        </strong>{" "}
                        ({order.listingId?.areaCouncil})
                      </p>
                    </div>

                    {order.paymentStatus === "held_in_escrow" && (
                      <button
                        onClick={() => handleConfirmDelivery(order._id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
                      >
                        <Truck className="w-4 h-4" /> Confirm Delivery & Release
                        Payout
                      </button>
                    )}

                    {order.paymentStatus === "released" && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Settled to Farmer
                        Wallet
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* PAYSTACK CHECKOUT MODAL */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" /> Initialize Paystack
                Escrow
              </h3>
              <button
                onClick={() => setSelectedListing(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInitiatePaystack} className="mt-4 space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                <p className="text-slate-400">
                  Produce:{" "}
                  <strong className="text-white">
                    {selectedListing.quantity}kg {selectedListing.cropType}
                  </strong>
                </p>
                <p className="text-slate-400">
                  Farmer:{" "}
                  <strong className="text-white">
                    {selectedListing.farmerId?.name} (
                    {selectedListing.areaCouncil})
                  </strong>
                </p>
                <p className="text-base font-bold text-emerald-400 pt-1">
                  Escrow Amount: NGN {selectedListing.price.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Buyer / Company Name
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Buyer Email (For Paystack Receipt)
                </label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Buyer Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={checkoutLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition"
              >
                {checkoutLoading
                  ? "Redirecting to Paystack..."
                  : `Pay NGN ${selectedListing.price.toLocaleString()} to Escrow`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
