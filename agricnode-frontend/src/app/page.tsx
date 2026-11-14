"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Phone,
  Sprout,
  ArrowRight,
  Smartphone,
  UserCheck,
  Lock,
  Wallet,
  MapPin,
  LayoutGrid,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Listing {
  _id: string;
  cropType: string;
  quantity: number;
  price: number;
  areaCouncil: string;
}

export default function Home() {
  const pathname = usePathname();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showFloatingUssd, setShowFloatingUssd] = useState(false);

  const [farmerPhone, setFarmerPhone] = useState("+2348011223344");
  const [ussdSessionActive, setUssdSessionActive] = useState(false);
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);
  const [ussdInput, setUssdInput] = useState("");
  const [ussdScreenText, setUssdScreenText] = useState(
    "Dial *384*100# to Register Farmer or List Harvest.",
  );
  const [ussdLoading, setUssdLoading] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/listings`);
      const json = await res.json();
      if (json.data) setListings(json.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const sendUssdPayload = async (newHistory: string[]) => {
    setUssdLoading(true);
    try {
      const body = new URLSearchParams({
        sessionId: "sim-01",
        serviceCode: "*384*100#",
        phoneNumber: farmerPhone,
        text: newHistory.join("*"),
      });
      const res = await fetch(`${API_BASE}/ussd`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const text = await res.text();
      setUssdSessionActive(text.startsWith("CON "));
      setUssdScreenText(text.replace(/^(CON|END)\s+/, ""));
      if (!text.startsWith("CON ")) {
        setUssdHistory([]);
        fetchListings();
      }
    } catch {
      setUssdScreenText("Error: Ensure backend is running on port 8000.");
      setUssdSessionActive(false);
    } finally {
      setUssdLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
      {/* FIXED HEADER */}
      <header className="sticky top-0 z-50 w-full bg-[#43b05c] text-white shadow-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 text-left group">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/25">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight block leading-none">
                AgriNode
              </span>
              <span className="text-[11px] text-white/80 tracking-wider uppercase font-semibold">
                USSD • Escrow
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/95">
            <Link
              href="/"
              className={`hover:text-white transition pb-1 ${pathname === "/" ? "border-b-2 border-white font-bold" : ""}`}
            >
              How It Works
            </Link>
            <Link
              href="/marketplace"
              className={`hover:text-white transition pb-1 flex items-center gap-1.5`}
            >
              Marketplace{" "}
              <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-full">
                {listings.length}
              </span>
            </Link>
            <button
              onClick={() => setShowFloatingUssd(!showFloatingUssd)}
              className="hover:text-white transition pb-1 flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5" /> Dial *384*100#
            </button>
          </nav>

          <Link
            href="/admin"
            className="px-6 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur text-sm font-semibold text-white transition flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" /> Escrow Login
          </Link>
        </div>

        {/* Mobile Nav Bar - Inside sticky header so it stays pinned */}
        <div className="md:hidden flex items-center justify-center gap-2 px-4 pb-4 flex-wrap">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-[#43b05c]"
          >
            Home
          </Link>
          <Link
            href="/marketplace"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white"
          >
            Marketplace
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT (Grows to push footer down) */}
      <div className="flex-grow">
        {/* Hero Section */}
        <div className="relative bg-[#43b05c] text-white overflow-hidden pt-8 pb-28 lg:pb-36">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-semibold tracking-wide uppercase">
                <Sprout className="w-3.5 h-3.5" /> Advancing Rural Digital
                Inclusion
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                AgriNode
                <span className="block text-white/90 font-light text-2xl sm:text-3xl mt-2">
                  Offline USSD Farm-to-Market & Escrow
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Smallholder farmers dial{" "}
                <strong className="underline decoration-white/60">
                  *384*100#
                </strong>{" "}
                on any basic 2G phone to list crops. Official crop images
                automatically attach from the Master Catalog. Urban buyers
                purchase with 100% Paystack Escrow protection.
              </p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/marketplace"
                  className="px-7 py-3.5 rounded-full bg-white text-[#35964b] hover:bg-slate-50 font-bold text-sm shadow-lg flex items-center gap-2 transition"
                >
                  Browse Verified Produce <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Interactive Mobile Phone */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[330px] bg-slate-900 rounded-[42px] p-4 shadow-2xl border-[6px] border-slate-800">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto mb-3" />
                <div className="mb-2.5 px-1">
                  <input
                    type="text"
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div className="bg-[#9bbc0f] text-slate-950 font-mono p-4 rounded-2xl min-h-[210px] flex flex-col justify-between shadow-inner border-4 border-slate-800">
                  <div className="text-[10px] font-bold border-b border-slate-950/20 pb-1 flex justify-between">
                    <span>MTN-NG • FCT</span>
                    <span>*384*100#</span>
                  </div>
                  <div className="my-2 whitespace-pre-line text-xs font-bold leading-snug">
                    {ussdLoading ? "Connecting..." : ussdScreenText}
                  </div>
                  <div className="text-[10px] opacity-75 text-right font-semibold">
                    {ussdSessionActive ? "CON" : "END"}
                  </div>
                </div>
                <div className="mt-3 px-1 pb-1">
                  {ussdSessionActive ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = [...ussdHistory, ussdInput.trim()];
                        setUssdHistory(next);
                        setUssdInput("");
                        sendUssdPayload(next);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={ussdInput}
                        onChange={(e) => setUssdInput(e.target.value)}
                        autoFocus
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="bg-[#43b05c] text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        Send
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setUssdHistory([]);
                        setUssdInput("");
                        sendUssdPayload([]);
                      }}
                      className="w-full bg-[#43b05c] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Phone className="w-4 h-4" /> Dial *384*100#
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* SVG Wave */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none">
            <svg
              viewBox="0 0 1440 110"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-14 sm:h-20 lg:h-24"
              preserveAspectRatio="none"
            >
              <path
                d="M0 20C480 120 960 120 1440 20V110H0V20Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
        </div>

        <section className="max-w-7xl mx-auto px-6 py-12 space-y-20">
          <div>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#43b05c]">
                End-to-End Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">
                How AgriNode Works
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#43b05c]/10 text-[#43b05c] flex items-center justify-center font-bold mb-4">
                  <Smartphone className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-[#43b05c] uppercase tracking-wider">
                  Step 01 • Offline USSD
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Farmer KYC & Crop Listing
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Farmers dial <strong>*384*100#</strong> on any 2G feature
                  phone to register their <strong>11-digit NIN</strong> and
                  broadcast harvest lots.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#43b05c]/10 text-[#43b05c] flex items-center justify-center font-bold mb-4">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-[#43b05c] uppercase tracking-wider">
                  Step 02 • Auto Image Sync
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Master Catalog Mapping
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Because 2G phones cannot upload photos, AgriNode automatically
                  attaches high-quality images and descriptions from the Admin's
                  catalog.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#43b05c]/10 text-[#43b05c] flex items-center justify-center font-bold mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-[#43b05c] uppercase tracking-wider">
                  Step 03 • Escrow Vault
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Protected Checkout
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Urban wholesalers browse verified produce and fund purchases
                  via <strong>Paystack</strong>. Funds lock in Escrow and the
                  buyer gets a <strong>6-digit PIN</strong>.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#43b05c]/10 text-[#43b05c] flex items-center justify-center font-bold mb-4">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-[#43b05c] uppercase tracking-wider">
                  Step 04 • Instant Settlement
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  PIN Confirmation
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Upon delivery, the buyer shares the PIN. The Escrow Officer
                  verifies it and releases <strong>98% of the funds</strong>{" "}
                  directly to the farmer.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto border-t border-slate-200 pt-16 pb-8">
            <div className="text-center mb-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#43b05c]">
                Platform Operations
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Frequently Asked Logistics Questions
              </h2>
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#43b05c]" />
                  1. How do buyers and sellers connect physically?
                </h4>
                <p className="text-sm text-slate-600 mt-2 pl-6">
                  During checkout, the buyer provides their delivery address.
                  The Escrow Officer views this and dispatches a truck to pick
                  up the harvest from the farmer's registered Area Council and
                  deliver it to the buyer.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#43b05c]" />
                  2. We didn't ask the farmer for a Bank Account. How are they
                  paid?
                </h4>
                <p className="text-sm text-slate-600 mt-2 pl-6">
                  To prevent USSD sessions from timing out, we only ask for the
                  NIN during onboarding. When the buyer confirms delivery, the
                  funds settle into the farmer's virtual{" "}
                  <strong>AgriNode Wallet</strong>. When ready for cash, they
                  dial <code>*384*100#</code>, select{" "}
                  <strong>"Withdraw to Bank"</strong>, and enter their 10-digit
                  account number.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-[#43b05c]" />
                  3. What is our gain? How is AgriNode getting paid?
                </h4>
                <p className="text-sm text-slate-600 mt-2 pl-6">
                  AgriNode deducts a flat{" "}
                  <strong>2% platform commission</strong> from the total
                  transaction value only at the point of final settlement. If a
                  crop sells for NGN 100,000, the farmer receives NGN 98,000,
                  and AgriNode retains NGN 2,000.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

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
