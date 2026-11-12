const express = require("express");
const router = express.Router();
const { checkout, confirmDelivery } = require("../controllers/orderController");

router.post("/checkout", checkout);
router.patch("/:orderId/confirm-delivery", confirmDelivery);

module.exports = router;
