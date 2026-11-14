const jwt = require("jsonwebtoken");

const loginEscrowAdmin = async (req, res) => {
  const { email, password } = req.body;

  const validEmail = process.env.ESCROW_ADMIN_EMAIL || "admin@agrinode.ng";
  const validPass = process.env.ESCROW_ADMIN_PASSWORD || "EscrowAdmin2026!";

  if (email !== validEmail || password !== validPass) {
    return res.status(401).json({
      status: "error",
      message: "Invalid Escrow Officer credentials",
    });
  }

  const token = jwt.sign(
    { email: validEmail, role: "escrow_admin" },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "12h" },
  );

  return res.status(200).json({
    status: "success",
    data: {
      token,
      admin: { email: validEmail, role: "Escrow Operations Officer" },
    },
  });
};

module.exports = { loginEscrowAdmin };
