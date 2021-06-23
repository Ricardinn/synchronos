// entry point
// load env
require("dotenv").config();

const path = require("path");

// initialize server instance
const Server = new (require("./core/Server"))({
  port: process.env.PORT || 5555,
  extraHeaders: {
    "Server-Agent": "movify",
  },
});

Server.configure((app) => {
  // set views
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  app.use(require("express").static(path.join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.render("index");
  });
});

Server.listen();
