const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery", true);

// Cached across invocations so a warm serverless function (Vercel) reuses the
// connection instead of opening a new one per request.
let connectionPromise = null;

function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongoUri, { dbName: env.mongoDbName })
      .then((conn) => {
        console.log(`[db] connected to MongoDB database "${env.mongoDbName}"`);
        return conn;
      })
      .catch((err) => {
        connectionPromise = null; // allow a retry on the next call
        throw err;
      });

    mongoose.connection.on("error", (err) => {
      console.error("[db] connection error:", err.message);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[db] disconnected");
      connectionPromise = null;
    });
  }
  return connectionPromise;
}

module.exports = connectDB;
