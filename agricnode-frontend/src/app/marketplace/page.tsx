"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  Lock,
  RefreshCw,
  MapPin,
  BadgeCheck,
  CreditCard,
  MessageSquare,
  X,
  Send,
  CheckCircle2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface CommentItem {
  _id: string;
  authorName: string;
  authorRole: string;
  text: string;
  createdAt: string;
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
  verifiedByAdmin?: boolean;
  comments?: CommentItem[];
  farmerId?: { name: string; phoneNumber: string };
}

interface Order {
  _id: string;
  amountPaid: number;
  deliveryPin?: string;
  paymentReference: string;
  paymentStatus: string;
  deliveryStatus: string;
  listingId?: {
    _id?: string;
    cropType: string;
    quantity: number;
    areaCouncil: string;
    farmerId?: { name: string };
  };
}

export default function Marketplace() {
  const pathname = usePathname();
  const [activeSubTab, setActiveSubTab] = useState<"market" | "tracker">(
    "market",
  );
  const [listings, setListings] = useState<Listing[]>([]);
  const [councilFilter, setCouncilFilter] = useState("ALL");
  const [loadingListings, setLoadingListings] = useState(false);

  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyerName, setBuyerName] = useState("Abuja Agro Wholesalers Ltd");
  const [buyerEmail, setBuyerEmail] = useState("procurement@abujaagro.ng");
  const [buyerAddress, setBuyerAddress] = useState(
    "Block B, Wuse Market, Abuja",
  );
  const [buyerPhone, setBuyerPhone] = useState("+2348099999999");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifiedOrderReceipt, setVerifiedOrderReceipt] =
    useState<Order | null>(null);

  const [trackRefInput, setTrackRefInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackError, setTrackError] = useState("");

  const fetchListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await fetch(`${API_BASE}/listings`, { cache: "no-store" });
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        // Only show crop lots that are still available for purchase
        const availableLots = json.data.filter(
          (item: Listing) => !item.status || item.status === "available",
        );
        setListings(availableLots);
      }
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    } finally {
      setLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (reference) {
      setActiveSubTab("tracker");
      setTrackRefInput(reference);
      fetch(`${API_BASE}/orders/verify/${reference}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.status === "success" && result.data) {
            setVerifiedOrderReceipt(result.data);
            setTrackedOrder(result.data);
          }
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
          fetchListings();
        })
        .catch((err) => {
          console.error("Verification error:", err);
          fetchListings();
        });
    } else {
      fetchListings();
    }
  }, [fetchListings]);

  const handlePostComment = async (e: React.FormEvent, listingId: string) => {
    e.preventDefault();
    if (!commentText.trim() || !commentAuthor.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/listings/${listingId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: commentAuthor,
          text: commentText,
          authorRole: "buyer",
        }),
      });
      if (res.ok) {
        setCommentText("");
        fetchListings();
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          buyerAddress,
        }),
      });
      const result = await res.json();
      const redirectUrl =
        result.data?.authorizationUrl || result.data?.authorization_url;
      if (res.ok && redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        alert(result.message || "Could not initialize checkout");
      }
    } catch {
      alert("Network error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError("");
    setTrackedOrder(null);
    if (!trackRefInput.trim()) return;
    try {
      const res = await fetch(
        `${API_BASE}/orders/track/${trackRefInput.trim()}`,
      );
      const result = await res.json();
      if (res.ok && result.data) setTrackedOrder(result.data);
      else setTrackError(result.message || "Order reference not found.");
    } catch {
      setTrackError("Failed to connect to server.");
    }
  };

  const filteredListings =
    councilFilter === "ALL"
      ? listings
      : listings.filter((l) => l.areaCouncil === councilFilter);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
      {/* FIXED HEADER */}
      <header className="sticky top-0 z-50 w-full bg-[#43b05c] text-white shadow-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/25">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-extrabold block leading-none">
                AgriNode
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
              className={`hover:text-white transition pb-1 flex items-center gap-1.5 border-b-2 border-white font-bold`}
            >
              Marketplace{" "}
              <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-full">
                {listings.length}
              </span>
            </Link>
          </nav>
          <Link
            href="/admin"
            className="px-6 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-sm font-semibold flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" /> Escrow Login
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-grow w-full">
        <div className="bg-[#43b05c] text-white">
          <div className="max-w-4xl mx-auto px-6 py-12 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Verified FCT Produce Marketplace
            </h1>
            <p className="text-sm text-white/90 mt-2">
              Every crop lot is listed by NIN-verified farmers via USSD and
              auto-populated with catalog images.
            </p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setActiveSubTab("market")}
                className={`px-5 py-2 rounded-full text-sm font-bold ${activeSubTab === "market" ? "bg-white text-[#43b05c]" : "bg-white/20 hover:bg-white/30 transition"}`}
              >
                Available Lots ({listings.length})
              </button>
              <button
                onClick={() => setActiveSubTab("tracker")}
                className={`px-5 py-2 rounded-full text-sm font-bold ${activeSubTab === "tracker" ? "bg-white text-[#43b05c]" : "bg-white/20 hover:bg-white/30 transition"}`}
              >
                Track Order & PIN
              </button>
            </div>
          </div>
        </div>

        {activeSubTab === "market" && (
          <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold">
                  Available FCT Produce Lots
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={councilFilter}
                  onChange={(e) => setCouncilFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium"
                >
                  <option value="ALL">All Area Councils</option>
                  <option value="Bwari">Bwari</option>
                  <option value="Gwagwalada">Gwagwalada</option>
                  <option value="Kuje">Kuje</option>
                  <option value="AMAC">AMAC</option>
                  <option value="Abaji">Abaji</option>
                  <option value="Kwali">Kwali</option>
                </select>
                <button
                  onClick={fetchListings}
                  className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loadingListings ? "animate-spin text-[#43b05c]" : ""}`}
                  />
                </button>
              </div>
            </div>

            {filteredListings.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
                <Sprout className="w-10 h-10 text-[#43b05c] mx-auto opacity-60" />
                <h3 className="text-base font-bold text-slate-700">
                  No Available Produce Lots
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All listed lots in this area have been locked in escrow or
                  sold. Dial <strong>*384*100#</strong> on the USSD simulator on
                  the homepage to list a new harvest lot.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map((item) => (
                  <div
                    key={item._id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm hover:border-[#43b05c] transition"
                  >
                    <div>
                      <div className="relative h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.cropType}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Sprout className="w-8 h-8 text-[#43b05c]/40" />
                        )}
                        <span className="absolute top-3 right-3 text-xs bg-white/95 border px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold">
                          <MapPin className="w-3 h-3 text-[#43b05c]" />{" "}
                          {item.areaCouncil}
                        </span>
                      </div>
                      <div className="p-5">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-lg font-bold">
                            {item.quantity}kg {item.cropType}
                          </h3>
                          <span className="text-xl font-extrabold text-[#43b05c]">
                            NGN {item.price.toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                          {item.description}
                        </p>
                        <div className="mt-4 pt-3 border-t text-xs text-slate-500 flex justify-between">
                          <span>
                            Seller:{" "}
                            <strong>{item.farmerId?.name || "Farmer"}</strong>
                          </span>
                          <span className="text-[#43b05c] flex items-center gap-1 font-semibold">
                            <BadgeCheck className="w-3.5 h-3.5" /> NIN Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedListing(item)}
                          className="flex-1 bg-[#43b05c] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#389e50]"
                        >
                          <CreditCard className="w-4 h-4" /> Buy with Escrow
                        </button>
                        <button
                          onClick={() =>
                            setOpenCommentsId(
                              openCommentsId === item._id ? null : item._id,
                            )
                          }
                          className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-200"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#43b05c]" />{" "}
                          {item.comments?.length || 0}
                        </button>
                      </div>

                      {openCommentsId === item._id && (
                        <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                          <div className="max-h-32 overflow-y-auto space-y-1.5">
                            {item.comments && item.comments.length > 0 ? (
                              item.comments.map((c) => (
                                <div
                                  key={c._id}
                                  className="bg-slate-50 p-2 rounded-lg"
                                >
                                  <span className="font-bold text-slate-800">
                                    {c.authorName}:{" "}
                                  </span>
                                  <span className="text-slate-600">
                                    {c.text}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">
                                No questions yet. Ask the farmer about harvest
                                quality or logistics.
                              </p>
                            )}
                          </div>
                          <form
                            onSubmit={(e) => handlePostComment(e, item._id)}
                            className="space-y-1.5 pt-1"
                          >
                            <input
                              type="text"
                              placeholder="Your Name / Company"
                              value={commentAuthor}
                              onChange={(e) => setCommentAuthor(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                              required
                            />
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Ask a question..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                                required
                              />
                              <button
                                type="submit"
                                className="bg-[#43b05c] text-white px-3 py-1.5 rounded-lg font-bold flex items-center"
                              >
                                <Send className="w-3 h-3" />
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {activeSubTab === "tracker" && (
          <main className="max-w-2xl mx-auto px-6 py-12">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold">
                  Lookup Your Order & Delivery PIN
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your Paystack Order Reference (e.g.,{" "}
                  <code className="text-[#43b05c] font-bold">AGR-...</code>)
                </p>
              </div>
              <form onSubmit={handleTrackOrder} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Order Reference"
                  value={trackRefInput}
                  onChange={(e) => setTrackRefInput(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono"
                />
                <button
                  type="submit"
                  className="bg-[#43b05c] hover:bg-[#389e50] text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  Lookup Order
                </button>
              </form>
              {trackError && (
                <p className="text-xs text-rose-600 font-medium">
                  {trackError}
                </p>
              )}
              {trackedOrder && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <span className="text-sm font-bold block">
                        {trackedOrder.listingId?.quantity
                          ? `${trackedOrder.listingId.quantity}kg ${trackedOrder.listingId.cropType || "Produce Lot"}`
                          : "Escrow Produce Order"}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {trackedOrder.paymentReference}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full font-bold bg-amber-100 text-amber-800">
                      {trackedOrder.paymentStatus
                        .toUpperCase()
                        .replace(/_/g, " ")}
                    </span>
                  </div>
                  {trackedOrder.deliveryPin && (
                    <div className="bg-white border-2 border-[#43b05c]/40 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold block">
                          6-Digit Delivery Release PIN
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Provide this PIN upon delivery to release funds to the
                          farmer.
                        </span>
                      </div>
                      <span className="text-2xl font-mono font-extrabold text-[#43b05c]">
                        {trackedOrder.deliveryPin}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {/* BUYER PAYMENT CONFIRMED & 6-DIGIT DELIVERY PIN RECEIPT MODAL */}
      {verifiedOrderReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-[#43b05c] flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5" /> Escrow Payment Locked!
              </h3>
              <button
                onClick={() => setVerifiedOrderReceipt(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                Your payment of{" "}
                <strong className="text-slate-900">
                  NGN {(verifiedOrderReceipt.amountPaid || 0).toLocaleString()}
                </strong>{" "}
                is now safely locked in <strong>AgriNode Escrow</strong>.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 block">
                  Your 6-Digit Delivery Release PIN
                </span>
                <span className="text-3xl font-mono font-extrabold text-[#43b05c] tracking-widest block">
                  {verifiedOrderReceipt.deliveryPin}
                </span>
                <span className="text-[11px] text-slate-500 block pt-1">
                  Reference:{" "}
                  <code className="text-slate-800 font-bold">
                    {verifiedOrderReceipt.paymentReference}
                  </code>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Share this 6-digit PIN only after inspecting and accepting your
                produce delivery.
              </p>
            </div>

            <button
              onClick={() => setVerifiedOrderReceipt(null)}
              className="mt-5 w-full bg-[#43b05c] hover:bg-[#389e50] text-white py-2.5 rounded-xl text-xs font-bold"
            >
              Got It, Saved My PIN
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-sm">Pay into AgriNode Escrow</h3>
              <button onClick={() => setSelectedListing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInitiatePaystack} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Buyer / Organization Name
                </label>
                <input
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Phone
                </label>
                <input
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Delivery Address
                </label>
                <textarea
                  required
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={checkoutLoading}
                className="w-full bg-[#43b05c] hover:bg-[#389e50] text-white py-2.5 rounded-xl text-xs font-bold"
              >
                {checkoutLoading
                  ? "Connecting to Paystack..."
                  : `Fund Escrow (NGN ${(selectedListing.price || 0).toLocaleString()})`}
              </button>
            </form>
          </div>
        </div>
      )}

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
            &copy; 2026 AgriNode FCT. Built for the USPF Changemaker Challenge.
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
