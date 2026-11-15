const express = require("express");
const router = express.Router();
const { requireEscrowAdmin } = require("../middleware/authMiddleware");
const {
  getEscrowDashboardData,
  initializeCheckout,
  verifyOrderPayment,
  trackOrderByReference,
  handlePaystackWebhook,
  markOrderInTransit,
  confirmDeliveryAndRelease,
} = require("../controllers/orderController");

// Public Buyer Marketplace Routes
router.post("/checkout", initializeCheckout);
router.get("/verify/:reference", verifyOrderPayment);
router.get("/track/:reference", trackOrderByReference);
router.post("/webhook", handlePaystackWebhook);

// Secured Escrow Admin Routes (JWT Protected)
router.get("/", requireEscrowAdmin, getEscrowDashboardData);
router.patch("/:orderId/dispatch", requireEscrowAdmin, markOrderInTransit);
router.patch(
  "/:orderId/confirm-delivery",
  requireEscrowAdmin,
  confirmDeliveryAndRelease,
);

module.exports = router;
