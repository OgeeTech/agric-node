const Order = require("../models/Order");
const Listing = require("../models/Listing");
const User = require("../models/User");
const {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} = require("../utils/paystack");

const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "listingId",
        populate: {
          path: "farmerId",
          select: "name phoneNumber areaCouncil walletBalance escrowBalance",
        },
      })
      .populate("buyerId", "name phoneNumber areaCouncil")
      .sort({ createdAt: -1 });

    res.status(200).json({ status: "success", data: orders });
  } catch (error) {
    console.error(`[Get Orders Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch orders" });
  }
};

/**
 * Step 1: Initialize Paystack Escrow Checkout
 */
const initializeCheckout = async (req, res) => {
  try {
    const {
      listingId,
      buyerName = "Abuja Agro Wholesalers",
      buyerEmail = "buyer@agrinode.ng",
      buyerPhone = "+2348099999999",
    } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing || listing.status !== "available") {
      return res
        .status(400)
        .json({ status: "error", message: "Crop is no longer available" });
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

    const reference = `AGR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Call Paystack API
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
      amountPaid: listing.price,
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
    res
      .status(500)
      .json({
        status: "error",
        message: error.message || "Payment initialization failed",
      });
  }
};

/**
 * Internal helper to lock funds in escrow once Paystack confirms payment
 */
const lockOrderInEscrow = async (order) => {
  if (order.paymentStatus !== "pending_payment") return order;

  order.paymentStatus = "held_in_escrow";
  order.deliveryStatus = "pending_dispatch";
  await order.save();

  const listing = await Listing.findById(order.listingId);
  if (listing) {
    listing.status = "pending_escrow";
    await listing.save();

    // Credit farmer's locked escrow balance
    const farmer = await User.findById(listing.farmerId);
    if (farmer) {
      farmer.escrowBalance += order.amountPaid;
      await farmer.save();
    }
  }

  return order;
};

/**
 * Step 2A: Verify Payment via Callback Reference
 */
const verifyOrderPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ paymentReference: reference });
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
        .json({ status: "success", message: "Already verified", data: order });
    }

    const verification = await verifyTransaction(reference);
    if (verification.status === "success") {
      await lockOrderInEscrow(order);
      return res.status(200).json({
        status: "success",
        message: "Payment verified and locked in escrow",
        data: order,
      });
    }

    return res
      .status(400)
      .json({ status: "error", message: "Payment not completed yet" });
  } catch (error) {
    console.error(`[Verify Error]: ${error.message}`);
    res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * Step 2B: Paystack Webhook Handler
 */
const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;
    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const order = await Order.findOne({ paymentReference: reference });
      if (order) {
        await lockOrderInEscrow(order);
      }
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error(`[Webhook Error]: ${error.message}`);
    res.status(500).send("Webhook error");
  }
};

/**
 * Step 3: Buyer Confirms Delivery -> Release Escrow to Farmer Wallet
 */
const confirmDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("listingId");
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });
    if (order.paymentStatus !== "held_in_escrow") {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Order is not currently held in escrow",
        });
    }

    order.deliveryStatus = "delivered";
    order.paymentStatus = "released";
    await order.save();

    const listing = await Listing.findById(order.listingId._id);
    listing.status = "sold";
    await listing.save();

    // Move funds from farmer's locked escrowBalance to withdrawable walletBalance
    const farmer = await User.findById(listing.farmerId);
    farmer.escrowBalance = Math.max(0, farmer.escrowBalance - order.amountPaid);
    farmer.walletBalance += order.amountPaid;
    await farmer.save();

    res.status(200).json({
      status: "success",
      message: "Delivery confirmed. Escrow funds released to farmer wallet.",
      data: { order, farmerWalletBalance: farmer.walletBalance },
    });
  } catch (error) {
    console.error(`[Delivery Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to confirm delivery" });
  }
};

module.exports = {
  getOrders,
  initializeCheckout,
  verifyOrderPayment,
  handlePaystackWebhook,
  confirmDelivery,
};
