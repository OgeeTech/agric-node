const jwt = require("jsonwebtoken");

const requireEscrowAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Escrow Vault requires Admin authentication",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "escrow_admin") {
      return res
        .status(403)
        .json({
          status: "error",
          message: "Forbidden: Insufficient privileges",
        });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({
        status: "error",
        message: "Invalid or expired Escrow session token",
      });
  }
};

module.exports = { requireEscrowAdmin };
