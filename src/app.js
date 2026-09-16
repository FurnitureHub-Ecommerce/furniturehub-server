const express = require("express");

const testRoute = require("./routes/test.route");
const authRoute = require("./routes/auth.route");

const app = express();


app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "FurnitureHub API is running",
  });
});

app.use("/api/auth", authRoute);
app.use("/api/test", testRoute);



module.exports = app;