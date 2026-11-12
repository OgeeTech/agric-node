const Order = require("../models/Order");
const Listing = require("../models/Listing");
const User = require("../models/User");

const checkout = async (req, res) => {
  try {
    const { listingId, buyerId } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing || listing.status !== "available") {
      return res
        .status(400)
        .json({ status: "error", message: "Crop is no longer available" });
    }

    // Lock the listing so others cannot buy it
    listing.status = "pending_escrow";
    await listing.save();

    const order = await Order.create({
      listingId,
      buyerId,
      amountPaid: listing.price,
      paymentStatus: "held_in_escrow",
      deliveryStatus: "pending_dispatch",
    });

    res.status(201).json({ status: "success", data: order });
  } catch (error) {
    console.error(`[Checkout Error]: ${error.message}`);
    res.status(500).json({ status: "error", message: "Checkout failed" });
  }
};

const confirmDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("listingId");
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Order not found" });

    // Update statuses
    order.deliveryStatus = "delivered";
    order.paymentStatus = "released";
    await order.save();

    const listing = await Listing.findById(order.listingId._id);
    listing.status = "sold";
    await listing.save();

    // Release funds to the farmer's wallet
    const farmer = await User.findById(listing.farmerId);
    farmer.walletBalance += order.amountPaid;
    await farmer.save();

    res
      .status(200)
      .json({
        status: "success",
        message: "Delivery confirmed, funds released to farmer",
      });
  } catch (error) {
    console.error(`[Delivery Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to confirm delivery" });
  }
};

module.exports = { checkout, confirmDelivery };
