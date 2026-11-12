require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  // Await database connection before opening the port
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(
      `[Server] Running in ${process.env.NODE_ENV} mode on port ${PORT}`,
    );
  });

  // Graceful Shutdown Logic
  const gracefulShutdown = () => {
    console.log("\n[Server] Shutting down gracefully...");
    server.close(() => {
      console.log("[Server] Closed out remaining connections.");
      process.exit(0);
    });

    // Force close if connections hang for more than 10 seconds
    setTimeout(() => {
      console.error("[Server] Forcing shutdown due to hanging connections");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

startServer();
