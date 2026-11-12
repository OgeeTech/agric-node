const Listing = require("../models/Listing");

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

module.exports = { getAvailableListings };
