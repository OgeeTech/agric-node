const express = require("express");
const router = express.Router();
const { handleUssd } = require("../controllers/ussdController");

router.post("/", handleUssd);

module.exports = router;
