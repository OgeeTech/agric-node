const express = require("express");
const router = express.Router();
const { requireEscrowAdmin } = require("../middleware/authMiddleware");
const {
  getAvailableListings,
  getAllListingsForAdmin,
  updateListingDetails,
  markListingAsSold,
  deleteListing,
  addListingComment,
} = require("../controllers/listingController");

// Public Buyer Routes
router.get("/", getAvailableListings);
router.post("/:id/comments", addListingComment);

// Secured Escrow Admin Routes
router.get("/admin/all", requireEscrowAdmin, getAllListingsForAdmin);
router.patch("/:id/details", requireEscrowAdmin, updateListingDetails);
router.patch("/:id/mark-sold", requireEscrowAdmin, markListingAsSold);
router.delete("/:id", requireEscrowAdmin, deleteListing);

module.exports = router;
