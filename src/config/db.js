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
      .connect(env.mongoUri, {
        dbName: env.mongoDbName,
        // Mongoose's default is 30s, which outlives a Vercel function's
        // execution limit — the function gets hard-killed (504
        // FUNCTION_INVOCATION_TIMEOUT) before this ever gets the chance to
        // reject with a real, useful error. Fail fast instead: a wrong URI or
        // a MongoDB Atlas IP allowlist that doesn't include Vercel's egress
        // IPs surfaces as a proper 500 + message within a few seconds.
        serverSelectionTimeoutMS: 8000,
      })
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
