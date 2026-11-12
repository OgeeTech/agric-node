const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Security & Logging Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Payload Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "success", message: "AgriNode API is running" });
});

// Route Mounting (To be un-commented as we build them)
// app.use('/api/ussd', require('./routes/ussdRoutes'));
// app.use('/api/listings', require('./routes/listingRoutes'));
// app.use('/api/orders', require('./routes/orderRoutes'));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
