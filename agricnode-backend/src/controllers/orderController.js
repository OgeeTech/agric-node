const crypto = require("crypto");
const Order = require("../models/Order");
const Listing = require("../models/Listing");
const User = require("../models/User");
const {
  initializeTransaction,
  verifyTransaction,
} = require("../utils/paystack");

// Helper for full nested population (Listing -> Farmer + Crop Product)
const listingPopulateConfig = {
  path: "listingId",
  populate: [
    { path: "farmerId", select: "name phoneNumber areaCouncil" },
    { path: "productId" },
  ],
};

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

    // Find or create buyer record
    let buyer = await User.findOne({ phoneNumber: buyerPhone });
    if (!buyer) {
      buyer = await User.create({
        name: buyerName,
        phoneNumber: buyerPhone,
        role: "buyer",
        areaCouncil: "AMAC",
      });
    }

    const reference = `AGR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const deliveryPin = Math.floor(100000 + Math.random() * 900000).toString();
    const platformFee = Math.round(listing.price * 0.02); // 2% escrow fee
    const farmerPayout = listing.price - platformFee;
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    const paystackData = await initializeTransaction({
      email: buyerEmail,
      amountNaira: listing.price,
      reference,
      callbackUrl: `${frontendUrl}/marketplace?reference=${reference}`,
      metadata: {
        listingId: listing._id.toString(),
        buyerId: buyer._id.toString(),
      },
    });

    const order = await Order.create({
      listingId: listing._id,
      buyerId: buyer._id,
      buyerEmail,
      buyerPhone,
      buyerAddress,
      amountPaid: listing.price,
      platformFee,
      farmerPayout,
      paymentReference: reference,
      deliveryPin,
      paymentStatus: "pending_payment",
      deliveryStatus: "awaiting_payment",
    });

    res.status(201).json({
      status: "success",
      data: {
        ...paystackData,
        authorizationUrl: paystackData.authorization_url,
        reference,
        deliveryPin,
        orderId: order._id,
      },
    });
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Could not initialize checkout",
    });
  }
};

exports.verifyOrderPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    let order = await Order.findOne({ paymentReference: reference }).populate(
      listingPopulateConfig,
    );
    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    }

    if (
      order.paymentStatus === "held_in_escrow" ||
      order.paymentStatus === "released"
    ) {
      return res.status(200).json({ status: "success", data: order });
    }

    const paystackTx = await verifyTransaction(reference);

    if (paystackTx.status === "success") {
      order.paymentStatus = "held_in_escrow";
      order.deliveryStatus = "pending_dispatch";

      if (!order.deliveryPin) {
        order.deliveryPin = Math.floor(
          100000 + Math.random() * 900000,
        ).toString();
      }

      await order.save();
      await Listing.findByIdAndUpdate(order.listingId._id || order.listingId, {
        status: "in_escrow",
      });

      return res.status(200).json({ status: "success", data: order });
    }

    res
      .status(400)
      .json({ status: "error", message: "Payment not completed on Paystack" });
  } catch (error) {
    console.error("Verification Error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Server error during verification" });
  }
};

exports.trackOrderByReference = async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ paymentReference: reference })
      .populate(listingPopulateConfig)
      .populate("buyerId", "name phoneNumber");

    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order reference not found" });
    }

    // Auto-backfill a 6-digit PIN if an older test order in DB was missing one
    if (!order.deliveryPin) {
      order.deliveryPin = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      await order.save();
    }

    res.status(200).json({ status: "success", data: order });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to track order" });
  }
};

exports.handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    if (event.event === "charge.success") {
      const { reference } = event.data;
      const order = await Order.findOne({ paymentReference: reference });

      if (order && order.paymentStatus === "pending_payment") {
        order.paymentStatus = "held_in_escrow";
        order.deliveryStatus = "pending_dispatch";
        if (!order.deliveryPin) {
          order.deliveryPin = Math.floor(
            100000 + Math.random() * 900000,
          ).toString();
        }
        await order.save();
        await Listing.findByIdAndUpdate(order.listingId, {
          status: "in_escrow",
        });
      }
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook error");
  }
};

exports.getEscrowDashboardData = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate(listingPopulateConfig)
      .populate("buyerId", "name phoneNumber")
      .sort("-createdAt");

    const metrics = {
      totalLockedInEscrow: 0,
      totalSettledToFarmers: 0,
      totalPlatformRevenue: 0,
      activeEscrowCount: 0,
      completedCount: 0,
    };

    for (const order of orders) {
      // Backfill missing PIN on any older orders so none show N/A in the Admin Vault
      if (!order.deliveryPin) {
        order.deliveryPin = Math.floor(
          100000 + Math.random() * 900000,
        ).toString();
        await order.save();
      }

      if (order.paymentStatus === "held_in_escrow") {
        metrics.totalLockedInEscrow += order.amountPaid || 0;
        metrics.activeEscrowCount += 1;
      } else if (order.paymentStatus === "released") {
        metrics.totalSettledToFarmers += order.farmerPayout || 0;
        metrics.totalPlatformRevenue += order.platformFee || 0;
        metrics.completedCount += 1;
      }
    }

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

exports.markOrderInTransit = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    }

    order.deliveryStatus = "in_transit";
    await order.save();

    res.status(200).json({
      status: "success",
      message: "Order marked as in-transit",
      data: order,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to update delivery status" });
  }
};

exports.confirmDeliveryAndRelease = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const submittedPin = (req.body.deliveryPin || req.body.pin || "").trim();

    const order = await Order.findById(orderId).populate("listingId");
    if (!order) {
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    }

    if (order.paymentStatus === "released") {
      return res
        .status(400)
        .json({ status: "error", message: "Funds have already been released" });
    }

    if (!submittedPin || order.deliveryPin !== submittedPin) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid 6-digit Delivery PIN" });
    }

    order.paymentStatus = "released";
    order.deliveryStatus = "delivered";
    order.releasedAt = new Date();
    await order.save();

    if (order.listingId) {
      await Listing.findByIdAndUpdate(order.listingId._id || order.listingId, {
        status: "sold",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Escrow funds released to farmer successfully!",
      data: order,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to release escrow" });
  }
};
