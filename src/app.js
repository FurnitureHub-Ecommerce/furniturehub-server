const express = require("express");
const authRoute = require("./routes/auth.route");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "FurnitureHub API is running",
  });
});

app.use("/api/auth", authRoute);

module.exports = app;