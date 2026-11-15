const Order = require("../models/Order");
const Listing = require("../models/Listing");

// Assuming you have a Paystack helper utility. If not, this is standard fetch logic.
const {
  initializeTransaction,
  verifyTransaction,
} = require("../utils/paystack");
// (If you use a different path or package for Paystack, just keep your existing import at the top)

// ============================================================================
// 1. BUYER CHECKOUT (Generates PIN & Redirects to /marketplace)
// ============================================================================
exports.initializeCheckout = async (req, res) => {
  try {
    const {
      listingId,
      buyerName = "Abuja Agro Wholesalers",
      buyerEmail = "procurement@abujaagro.ng",
      buyerPhone = "+2348099999999",
      buyerAddress = "Wuse Market, Abuja",
    } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res
        .status(404)
        .json({ status: "error", message: "Crop listing not found" });
    }

    if (listing.status !== "available") {
      return res
        .status(400)
        .json({ status: "error", message: "This lot is no longer available" });
    }

    // You likely have a Buyer/User lookup here. We'll use a placeholder ID if you don't enforce strict buyer auth.
    const buyerId = req.user ? req.user._id : "000000000000000000000000";

    const reference = `AGR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const deliveryPin = Math.floor(100000 + Math.random() * 900000).toString(); // FIX: Generate 6-digit PIN upfront

    const platformFee = Math.round(listing.price * 0.02); // 2% escrow fee
    const farmerPayout = listing.price - platformFee;
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    // FIX: callbackUrl now correctly points to /marketplace
    const paystackData = await initializeTransaction({
      email: buyerEmail,
      amountNaira: listing.price,
      reference,
      callbackUrl: `${frontendUrl}/marketplace?reference=${reference}`,
      metadata: {
        listingId: listing._id.toString(),
        buyerId: buyerId.toString(),
      },
    });

    const order = await Order.create({
      listingId: listing._id,
      buyerId,
      buyerEmail,
      buyerPhone,
      buyerAddress, // Saved for logistics
      amountPaid: listing.price,
      platformFee,
      farmerPayout,
      paymentReference: reference,
      deliveryPin, // FIX: PIN is saved immediately
      paymentStatus: "pending_payment",
      deliveryStatus: "awaiting_payment",
    });

    // Mark listing as pending so others don't buy it during checkout
    listing.status = "pending_escrow";
    await listing.save();

    res.status(200).json({ status: "success", data: paystackData });
  } catch (error) {
    console.error("Checkout Error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Could not initialize checkout" });
  }
};

// ============================================================================
// 2. VERIFY PAYMENT (Runs when buyer redirects back from Paystack)
// ============================================================================
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Check our DB first
    let order = await Order.findOne({ paymentReference: reference }).populate(
      "listingId",
    );
    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    }

    // If already verified, just return it
    if (
      order.paymentStatus === "held_in_escrow" ||
      order.paymentStatus === "released"
    ) {
      return res.status(200).json({ status: "success", data: order });
    }

    // Verify with Paystack API
    const paystackStatus = await verifyTransaction(reference);

    if (paystackStatus.status === "success") {
      order.paymentStatus = "held_in_escrow";
      order.deliveryStatus = "pending_dispatch";

      // Safety net: ensure PIN exists
      if (!order.deliveryPin) {
        order.deliveryPin = Math.floor(
          100000 + Math.random() * 900000,
        ).toString();
      }

      await order.save();
      return res.status(200).json({ status: "success", data: order });
    }

    res
      .status(400)
      .json({ status: "error", message: "Payment verification failed" });
  } catch (error) {
    console.error("Verification Error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Server error during verification" });
  }
};

// ============================================================================
// 3. TRACK ORDER (Public Buyer Route)
// ============================================================================
exports.trackOrder = async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ paymentReference: reference }).populate(
      {
        path: "listingId",
        populate: { path: "farmerId", select: "name phoneNumber areaCouncil" },
      },
    );

    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    }

    res.status(200).json({ status: "success", data: order });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to track order" });
  }
};

// ============================================================================
// 4. GET ALL ORDERS (Secured Admin Vault Route)
// ============================================================================
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "listingId",
        populate: { path: "farmerId", select: "name phoneNumber" },
      })
      .sort("-createdAt");

    // Calculate Vault Metrics
    const metrics = {
      totalLockedInEscrow: 0,
      totalSettledToFarmers: 0,
      totalPlatformRevenue: 0,
      activeEscrowCount: 0,
      completedCount: 0,
    };

    orders.forEach((order) => {
      if (order.paymentStatus === "held_in_escrow") {
        metrics.totalLockedInEscrow += order.amountPaid || 0;
        metrics.activeEscrowCount += 1;
      } else if (order.paymentStatus === "released") {
        metrics.totalSettledToFarmers += order.farmerPayout || 0;
        metrics.totalPlatformRevenue += order.platformFee || 0;
        metrics.completedCount += 1;
      }
    });

    res.status(200).json({
      status: "success",
      data: { orders, metrics },
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch vault data" });
  }
};

// ============================================================================
// 5. DISPATCH ORDER (Secured Admin Route - Marks Logistics In-Transit)
// ============================================================================
exports.dispatchOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });

    order.deliveryStatus = "in_transit";
    await order.save();

    res
      .status(200)
      .json({ status: "success", message: "Order marked as in-transit" });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to update delivery status" });
  }
};

// ============================================================================
// 6. CONFIRM DELIVERY & PAYOUT (Secured Admin Route - Escrow Release)
// ============================================================================
exports.confirmDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPin } = req.body;

    const order = await Order.findById(id).populate("listingId");
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });

    if (order.paymentStatus === "released") {
      return res
        .status(400)
        .json({ status: "error", message: "Funds have already been released" });
    }

    if (order.deliveryPin !== deliveryPin.trim()) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid 6-digit Delivery PIN" });
    }

    // Success - Release Funds
    order.paymentStatus = "released";
    order.deliveryStatus = "delivered";
    await order.save();

    // Mark listing as permanently sold
    if (order.listingId) {
      order.listingId.status = "sold";
      await order.listingId.save();
    }

    // NOTE: In a real system, you would trigger the Paystack Transfers API here
    // to instantly push the `order.farmerPayout` to the Farmer's registered Bank Account.

    res
      .status(200)
      .json({
        status: "success",
        message: "Escrow funds released to farmer successfully!",
      });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to release escrow" });
  }
};
