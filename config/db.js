// config/db.js
require("colors");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log(
      `DataBase is Connected to Server ${process.env.PORT} and ${conn.connection.host}:${conn.connection.port}`
        .underline.bgBlue
    );
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    console.log(`Error Occured : ${error.message}`.underline.bgRed);
    process.exit(1);
  }
};

module.exports = connectDB;
