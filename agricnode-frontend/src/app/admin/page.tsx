"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Sprout,
  RefreshCw,
  KeyRound,
  LogOut,
  Wallet,
  CheckCircle2,
  LayoutGrid,
  ImagePlus,
  Trash2,
  Edit3,
  CheckSquare,
  Truck,
  X,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Product {
  _id: string;
  name: string;
  ussdCode: string;
  imageUrl: string;
  baseDescription: string;
}
interface Listing {
  _id: string;
  cropType: string;
  quantity: number;
  price: number;
  areaCouncil: string;
  status: string;
  imageUrl?: string;
  description?: string;
  farmerId?: { name: string; phoneNumber: string };
}
interface Order {
  _id: string;
  amountPaid: number;
  platformFee: number;
  farmerPayout: number;
  deliveryPin?: string;
  paymentReference: string;
  paymentStatus: string;
  deliveryStatus: string;
  listingId?: {
    cropType: string;
    quantity: number;
    areaCouncil: string;
    farmerId?: { name: string; phoneNumber: string };
  };
}
interface VaultMetrics {
  totalLockedInEscrow: number;
  totalSettledToFarmers: number;
  totalPlatformRevenue: number;
  activeEscrowCount: number;
  completedCount: number;
}

export default function AdminVault() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("admin@agrinode.ng");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [adminListings, setAdminListings] = useState<Listing[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [metrics, setMetrics] = useState<VaultMetrics>({
    totalLockedInEscrow: 0,
    totalSettledToFarmers: 0,
    totalPlatformRevenue: 0,
    activeEscrowCount: 0,
    completedCount: 0,
  });
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});

  const [newProdName, setNewProdName] = useState("");
  const [newProdUssd, setNewProdUssd] = useState("");
  const [newProdImage, setNewProdImage] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const fetchEscrowVault = useCallback(async (token: string) => {
    try {
      const [ordRes, listRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/listings/admin/all`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/products`),
      ]);
      if (ordRes.status === 401) {
        setAdminToken(null);
        localStorage.removeItem("agrinode_escrow_jwt");
        return;
      }
      const ordJson = await ordRes.json();
      const listJson = await listRes.json();
      const prodJson = await prodRes.json();
      if (ordJson.data) {
        setOrders(ordJson.data.orders || []);
        if (ordJson.data.metrics) setMetrics(ordJson.data.metrics);
      }
      if (listJson.data) setAdminListings(listJson.data);
      if (prodJson.data) setCatalog(prodJson.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("agrinode_escrow_jwt");
    if (savedToken) {
      setAdminToken(savedToken);
      fetchEscrowVault(savedToken);
    }
  }, [fetchEscrowVault]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const result = await res.json();
      if (res.ok && result.data?.token) {
        setAdminToken(result.data.token);
        localStorage.setItem("agrinode_escrow_jwt", result.data.token);
        fetchEscrowVault(result.data.token);
      } else setLoginError(result.message);
    } catch {
      setLoginError("Server error");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingProduct(true);
    try {
      await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: newProdName,
          ussdCode: newProdUssd,
          imageUrl: newProdImage,
          baseDescription: newProdDesc,
        }),
      });
      setNewProdName("");
      setNewProdUssd("");
      setNewProdImage("");
      setNewProdDesc("");
      fetchEscrowVault(adminToken);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleReleaseEscrow = async (orderId: string) => {
    if (!adminToken) return;
    const res = await fetch(`${API_BASE}/orders/${orderId}/confirm-delivery`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ deliveryPin: pinInputs[orderId] || "" }),
    });
    if (res.ok) fetchEscrowVault(adminToken);
    else alert((await res.json()).message);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* FIXED HEADER */}
      <header className="sticky top-0 z-50 w-full bg-slate-900 text-white shadow-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#43b05c]" />
            <span className="font-bold">AgriNode Escrow Vault</span>
          </Link>
          <div className="flex gap-4 items-center">
            <Link
              href="/marketplace"
              className="text-sm font-medium hover:text-[#43b05c] transition"
            >
              Marketplace
            </Link>
            {adminToken && (
              <button
                onClick={() => {
                  setAdminToken(null);
                  localStorage.removeItem("agrinode_escrow_jwt");
                }}
                className="text-sm font-bold bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT (Grows to push footer down) */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-grow w-full">
        {!adminToken ? (
          <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-lg mt-12">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#43b05c]" /> Escrow Login
            </h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
              {loginError && (
                <p className="text-xs text-rose-600 font-bold">{loginError}</p>
              )}
              <button
                type="submit"
                className="w-full bg-[#43b05c] hover:bg-[#389e50] text-white py-2.5 rounded-xl text-sm font-bold transition"
              >
                Unlock Vault
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border p-5 rounded-2xl">
                <span className="text-xs text-amber-600 font-bold uppercase">
                  Locked Escrow
                </span>
                <p className="text-2xl font-extrabold">
                  NGN {metrics.totalLockedInEscrow.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border p-5 rounded-2xl">
                <span className="text-xs text-[#43b05c] font-bold uppercase">
                  Disbursed to Farmers
                </span>
                <p className="text-2xl font-extrabold">
                  NGN {metrics.totalSettledToFarmers.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border p-5 rounded-2xl">
                <span className="text-xs text-indigo-600 font-bold uppercase">
                  Platform Revenue (2%)
                </span>
                <p className="text-2xl font-extrabold">
                  NGN {metrics.totalPlatformRevenue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <LayoutGrid className="w-4 h-4 text-[#43b05c]" /> Master Crop
                Catalog
              </h3>
              <form
                onSubmit={handleAddProduct}
                className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-xl border"
              >
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Crop Name
                  </label>
                  <input
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    USSD Reply Code
                  </label>
                  <input
                    required
                    type="number"
                    value={newProdUssd}
                    onChange={(e) => setNewProdUssd(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Image URL
                  </label>
                  <input
                    required
                    type="url"
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Default Note
                  </label>
                  <input
                    required
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="w-full bg-[#43b05c] hover:bg-[#389e50] transition text-white font-bold py-2 rounded-lg text-sm"
                >
                  {savingProduct ? "Adding..." : "Add to Catalog"}
                </button>
              </form>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
                {catalog.map((prod) => (
                  <div
                    key={prod._id}
                    className="border rounded-xl overflow-hidden relative"
                  >
                    <img
                      src={prod.imageUrl}
                      className="h-24 w-full object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] px-2 rounded-full font-bold">
                      Code: {prod.ussdCode}
                    </span>
                    <div className="p-2 text-center text-sm font-bold">
                      {prod.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4">
                Escrow Transactions & Payouts
              </h3>
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="bg-slate-50 border rounded-xl p-4 flex flex-col lg:flex-row justify-between gap-4 mb-3"
                >
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-sm block">
                      {order.listingId?.quantity}kg {order.listingId?.cropType}{" "}
                      — Ref: {order.paymentReference}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${order.paymentStatus === "held_in_escrow" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                    >
                      {order.paymentStatus.toUpperCase()}
                    </span>
                    <p className="pt-2">
                      Paid: NGN {(order.amountPaid || 0).toLocaleString()} •
                      Payout:{" "}
                      <strong className="text-[#43b05c]">
                        NGN {(order.farmerPayout || 0).toLocaleString()}
                      </strong>
                    </p>
                    <p>
                      Seller: {order.listingId?.farmerId?.name} (
                      {order.listingId?.farmerId?.phoneNumber}) | Delivery PIN:{" "}
                      <strong className="text-amber-700">
                        {order.deliveryPin || "N/A"}
                      </strong>
                    </p>
                  </div>
                  {order.paymentStatus === "held_in_escrow" && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit PIN"
                        value={pinInputs[order._id] || ""}
                        onChange={(e) =>
                          setPinInputs({
                            ...pinInputs,
                            [order._id]: e.target.value,
                          })
                        }
                        className="w-32 border rounded-lg px-3 py-2 text-xs font-mono"
                      />
                      <button
                        onClick={() => handleReleaseEscrow(order._id)}
                        className="px-4 py-2 rounded-lg bg-[#43b05c] hover:bg-[#389e50] transition text-white text-xs font-bold"
                      >
                        Verify PIN & Pay Farmer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#43b05c]" /> AgriNode
            </h4>
            <p className="text-xs leading-relaxed max-w-xs">
              Bridging the rural connectivity gap and solving the two-sided
              trust deficit between remote farmers and urban buyers via offline
              USSD and Paystack Escrow.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3">Platform Links</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-[#43b05c] transition">
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/marketplace"
                  className="hover:text-[#43b05c] transition"
                >
                  Buyer Marketplace
                </Link>
              </li>
              <li>
                <Link
                  href="/marketplace"
                  className="hover:text-[#43b05c] transition"
                >
                  Track Delivery PIN
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#43b05c] transition">
                  Escrow Officer Login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3">Contact & Legal</h4>
            <ul className="space-y-2 text-xs">
              <li>
                USSD Code: <strong className="text-[#43b05c]">*384*100#</strong>
              </li>
              <li>Email: support@agrinode.ng</li>
              <li>Location: Bwari, FCT, Nigeria</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-6 mt-8 border-t border-slate-800 text-[11px] flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            &copy; {new Date().getFullYear()} AgriNode FCT. Built for the USPF
            Changemaker Challenge.
          </p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white transition">
              Terms of Service
            </Link>
            <Link href="#" className="hover:text-white transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
