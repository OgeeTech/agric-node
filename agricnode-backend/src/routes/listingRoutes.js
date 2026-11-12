const express = require("express");
const router = express.Router();
const { getAvailableListings } = require("../controllers/listingController");

router.get("/", getAvailableListings);

module.exports = router;
