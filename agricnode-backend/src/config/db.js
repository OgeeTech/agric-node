const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Mongoose 6+ automatically handles legacy options like useNewUrlParser
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database] Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
