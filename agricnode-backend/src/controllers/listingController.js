const Listing = require("../models/Listing");

/**
 * PUBLIC: Get available listings for the Buyer Marketplace
 */
const getAvailableListings = async (req, res) => {
  try {
    const listings = await Listing.find({ status: "available" })
      .populate("farmerId", "name phoneNumber areaCouncil nin isRegistered")
      .sort({ createdAt: -1 });

    res.status(200).json({ status: "success", data: listings });
  } catch (error) {
    console.error(`[Listing Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch listings" });
  }
};

/**
 * PROTECTED (Admin): Get all listings (available, pending_escrow, sold) for Escrow Management
 */
const getAllListingsForAdmin = async (req, res) => {
  try {
    const listings = await Listing.find()
      .populate("farmerId", "name phoneNumber areaCouncil nin isRegistered")
      .sort({ createdAt: -1 });

    res.status(200).json({ status: "success", data: listings });
  } catch (error) {
    console.error(`[Admin Listings Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch admin listings" });
  }
};

/**
 * PROTECTED (Admin): Add/Update Product Image & Description after calling the farmer
 */
const updateListingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, description, areaCouncil } = req.body;

    const listing = await Listing.findById(id).populate(
      "farmerId",
      "areaCouncil",
    );
    if (!listing) {
      return res
        .status(404)
        .json({ status: "error", message: "Listing not found" });
    }

    if (imageUrl !== undefined) listing.imageUrl = imageUrl;
    if (description !== undefined) listing.description = description;

    // Backfill areaCouncil for legacy test listings created before the KYC upgrade
    if (!listing.areaCouncil) {
      listing.areaCouncil =
        areaCouncil || listing.farmerId?.areaCouncil || "Bwari";
    }

    listing.verifiedByAdmin = Boolean(listing.imageUrl || listing.description);

    await listing.save();

    res.status(200).json({
      status: "success",
      message: "Product image and description updated by Escrow Admin",
      data: listing,
    });
  } catch (error) {
    console.error(`[Update Listing Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to update listing details" });
  }
};

/**
 * PROTECTED (Admin): Manually mark a product as Sold
 */
const markListingAsSold = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(
      id,
      { status: "sold" },
      { new: true },
    );

    if (!listing) {
      return res
        .status(404)
        .json({ status: "error", message: "Listing not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Product marked as sold",
      data: listing,
    });
  } catch (error) {
    console.error(`[Mark Sold Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to mark product as sold" });
  }
};

/**
 * PROTECTED (Admin): Delete a product listing
 */
const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findByIdAndDelete(id);

    if (!listing) {
      return res
        .status(404)
        .json({ status: "error", message: "Listing not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Product listing deleted permanently",
    });
  } catch (error) {
    console.error(`[Delete Listing Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to delete listing" });
  }
};

/**
 * PUBLIC: Buyers (or Admin) add comments/questions on a product
 */
const addListingComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorName, text, authorRole = "buyer" } = req.body;

    if (!authorName || !text || !text.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Name and comment text are required",
      });
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      return res
        .status(404)
        .json({ status: "error", message: "Product not found" });
    }

    listing.comments.push({
      authorName: authorName.trim(),
      authorRole: authorRole === "escrow_admin" ? "escrow_admin" : "buyer",
      text: text.trim(),
    });

    await listing.save();

    const populated = await Listing.findById(id).populate(
      "farmerId",
      "name phoneNumber areaCouncil nin isRegistered",
    );

    res.status(201).json({
      status: "success",
      message: "Comment posted",
      data: populated,
    });
  } catch (error) {
    console.error(`[Comment Error]: ${error.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Failed to post comment" });
  }
};

module.exports = {
  getAvailableListings,
  getAllListingsForAdmin,
  updateListingDetails,
  markListingAsSold,
  deleteListing,
  addListingComment,
};
