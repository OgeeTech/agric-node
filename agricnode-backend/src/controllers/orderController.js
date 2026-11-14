const Order = require("../models/Order");
const Listing = require("../models/Listing");
const User = require("../models/User");
const {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} = require("../utils/paystack");

/**
 * PROTECTED: Get all Escrow Orders + Vault KPI Metrics
 */
const getEscrowDashboardData = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "listingId",
        populate: {
          path: "farmerId",
          select:
            "name phoneNumber areaCouncil nin walletBalance escrowBalance",
        },
      })
      .populate("buyerId", "name phoneNumber areaCouncil")
      .sort({ createdAt: -1 });

    const metrics = orders.reduce(
      (acc, order) => {
        if (order.paymentStatus === "held_in_escrow") {
          // Fallback to 0 if amountPaid is missing
          acc.totalLockedInEscrow += order.amountPaid || 0;
          acc.activeEscrowCount += 1;
        } else if (order.paymentStatus === "released") {
          // Fallback to 0 for legacy orders missing these fields
          acc.totalSettledToFarmers += order.farmerPayout || 0;
          acc.totalPlatformRevenue += order.platformFee || 0;
          acc.completedCount += 1;
        }
        return acc;
      },
      {
        totalLockedInEscrow: 0,
        totalSettledToFarmers: 0,
        totalPlatformRevenue: 0,
        activeEscrowCount: 0,
        completedCount: 0,
      },
    );

    res.status(200).json({ status: "success", data: { orders, metrics } });
  } catch (error) {
    console.error(`[Escrow Vault Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to load Escrow Vault data" });
  }
};

/**
 * PUBLIC: Buyer initializes Paystack Escrow Checkout
 */
const initializeCheckout = async (req, res) => {
  try {
    const {
      listingId,
      buyerName = "Abuja Agro Wholesalers",
      buyerEmail = "procurement@abujaagro.ng",
      buyerPhone = "+2348099999999",
      buyerAddress = "Wuse Market, Abuja", // Pull it from req.body
    } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing || listing.status !== "available") {
      return res.status(400).json({
        status: "error",
        message: "Produce lot is no longer available",
      });
    }

    let buyer = await User.findOne({ phoneNumber: buyerPhone });
    if (!buyer) {
      buyer = await User.create({
        phoneNumber: buyerPhone,
        name: buyerName,
        role: "buyer",
        areaCouncil: "AMAC",
        isRegistered: true,
      });
    }

    const reference = `AGR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const platformFee = Math.round(listing.price * 0.02); // 2% escrow fee
    const farmerPayout = listing.price - platformFee;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const paystackData = await initializeTransaction({
      email: buyerEmail,
      amountNaira: listing.price,
      reference,
      callbackUrl: `${frontendUrl}?reference=${reference}`,
      metadata: {
        listingId: listing._id.toString(),
        buyerId: buyer._id.toString(),
      },
    });

    const order = await Order.create({
      listingId: listing._id,
      buyerId: buyer._id,
      buyerEmail,
      buyerAddress,
      buyerPhone,
      amountPaid: listing.price,
      platformFee,
      farmerPayout,
      paymentReference: reference,
      authorizationUrl: paystackData.authorization_url,
      paymentStatus: "pending_payment",
      deliveryStatus: "awaiting_payment",
    });

    res.status(201).json({
      status: "success",
      data: {
        order,
        authorizationUrl: paystackData.authorization_url,
        reference,
      },
    });
  } catch (error) {
    console.error(`[Paystack Init Error]: ${error.message}`);
    res.status(500).json({
      status: "error",
      message: error.message || "Payment initialization failed",
    });
  }
};

/**
 * Helper: Lock funds in Escrow & generate 6-digit Buyer Delivery PIN
 */
const lockOrderInEscrow = async (order) => {
  if (order.paymentStatus !== "pending_payment") return order;

  const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
  order.paymentStatus = "held_in_escrow";
  order.deliveryStatus = "pending_dispatch";
  order.deliveryPin = generatedPin;
  await order.save();

  const listing = await Listing.findById(order.listingId);
  if (listing) {
    listing.status = "pending_escrow";
    await listing.save();

    const farmer = await User.findById(listing.farmerId);
    if (farmer) {
      farmer.escrowBalance += order.farmerPayout;
      await farmer.save();
    }
  }

  return order;
};

/**
 * PUBLIC: Verify Paystack Payment & Return Buyer's 6-Digit Delivery PIN
 */
const verifyOrderPayment = async (req, res) => {
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
        .json({ status: "error", message: "Order reference not found" });
    }

    if (
      order.paymentStatus === "held_in_escrow" ||
      order.paymentStatus === "released"
    ) {
      return res
        .status(200)
        .json({ status: "success", message: "Payment verified", data: order });
    }

    const verification = await verifyTransaction(reference);
    if (verification.status === "success") {
      await lockOrderInEscrow(order);
      return res.status(200).json({
        status: "success",
        message: "Funds locked in AgriNode Escrow!",
        data: order,
      });
    }

    return res
      .status(400)
      .json({ status: "error", message: "Payment not completed on Paystack" });
  } catch (error) {
    console.error(`[Verify Error]: ${error.message}`);
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * PUBLIC: Buyer Order Tracker (Lookup by Reference)
 */
const trackOrderByReference = async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ paymentReference: reference.trim() })
      .populate({
        path: "listingId",
        populate: { path: "farmerId", select: "name phoneNumber areaCouncil" },
      })
      .populate("buyerId", "name phoneNumber");

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "No order found with that reference",
      });
    }

    res.status(200).json({ status: "success", data: order });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to track order" });
  }
};

/**
 * PUBLIC: Paystack Webhook
 */
const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    if (event.event === "charge.success") {
      const order = await Order.findOne({
        paymentReference: event.data.reference,
      });
      if (order) await lockOrderInEscrow(order);
    }

    res.status(200).send("Webhook processed");
  } catch (error) {
    res.status(500).send("Webhook error");
  }
};

/**
 * PROTECTED (Admin): Mark Order as Dispatched / In-Transit
 */
const markOrderInTransit = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== "held_in_escrow") {
      return res.status(400).json({
        status: "error",
        message: "Order must be held in escrow first",
      });
    }

    order.deliveryStatus = "in_transit";
    await order.save();

    res.status(200).json({
      status: "success",
      message: "Order marked as In-Transit",
      data: order,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to update dispatch status" });
  }
};

/**
 * PROTECTED (Admin + Delivery PIN): Confirm Delivery & Release Payout to Farmer
 */
const confirmDeliveryAndRelease = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryPin } = req.body;

    const order = await Order.findById(orderId).populate("listingId");
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    if (order.paymentStatus !== "held_in_escrow") {
      return res.status(400).json({
        status: "error",
        message: "Funds are not currently held in escrow",
      });
    }

    // Verify 6-digit Buyer Delivery PIN
    if (!deliveryPin || order.deliveryPin !== deliveryPin.trim()) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid 6-digit Buyer Delivery PIN. Cannot release escrow funds.",
      });
    }

    order.deliveryStatus = "delivered";
    order.paymentStatus = "released";
    order.releasedAt = new Date();
    order.releasedBy = req.admin?.email || "Escrow Officer";
    await order.save();

    const listing = await Listing.findById(order.listingId._id);
    listing.status = "sold";
    await listing.save();

    // Move net payout from farmer's locked escrowBalance to withdrawable walletBalance
    const farmer = await User.findById(listing.farmerId);
    farmer.escrowBalance = Math.max(
      0,
      farmer.escrowBalance - order.farmerPayout,
    );
    farmer.walletBalance += order.farmerPayout;
    await farmer.save();

    res.status(200).json({
      status: "success",
      message: `NGN ${order.farmerPayout.toLocaleString()} released to ${farmer.name}'s wallet!`,
      data: { order, farmerWalletBalance: farmer.walletBalance },
    });
  } catch (error) {
    console.error(`[Release Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to release escrow funds" });
  }
};

module.exports = {
  getEscrowDashboardData,
  initializeCheckout,
  verifyOrderPayment,
  trackOrderByReference,
  handlePaystackWebhook,
  markOrderInTransit,
  confirmDeliveryAndRelease,
};
