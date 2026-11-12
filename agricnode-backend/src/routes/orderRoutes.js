const express = require("express");
const router = express.Router();
const {
  getOrders,
  initializeCheckout,
  verifyOrderPayment,
  handlePaystackWebhook,
  confirmDelivery,
} = require("../controllers/orderController");

router.get("/", getOrders);
router.post("/checkout", initializeCheckout);
router.get("/verify/:reference", verifyOrderPayment);
router.post("/webhook", handlePaystackWebhook);
router.patch("/:orderId/confirm-delivery", confirmDelivery);

module.exports = router;
