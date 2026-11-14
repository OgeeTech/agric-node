const express = require("express");
const router = express.Router();
const { loginEscrowAdmin } = require("../controllers/authController");

router.post("/login", loginEscrowAdmin);

module.exports = router;
