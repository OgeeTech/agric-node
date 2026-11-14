const express = require("express");
const router = express.Router();
const { requireEscrowAdmin } = require("../middleware/authMiddleware");
const {
  getCatalog,
  addProduct,
  deleteProduct,
} = require("../controllers/productController");

router.get("/", getCatalog); // Public (for USSD and frontend rendering)
router.post("/", requireEscrowAdmin, addProduct); // Admin only
router.delete("/:id", requireEscrowAdmin, deleteProduct); // Admin only

module.exports = router;
