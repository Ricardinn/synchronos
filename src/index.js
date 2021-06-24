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

// initialize FTP instance
const { FTP_EVENTS } = require("./core/FTP");
const FTP = new (require("./core/FTP").default)({
  ftpOptions: {
    host: process.env.FTP_HOST || "localhost",
    port: process.env.FTP_PORT || 21,
    user: process.env.FTP_USER || "anonymous",
    password: process.env.FTP_PASSWORD || "anonymous@",
  },
  downloadDir: path.join(__dirname, "downloads"),
});

FTP.on(FTP_EVENTS.FTP_READY, () => {
  console.log("FTP READY");
});

// FTP.connect();

Server.configure((app) => {
  // set views
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  // Store FTP instance to make uploads to CDN
  app.set("FTP", FTP);

  app.use(require("express").static(path.join(__dirname, "public")));
  app.use(require("express").urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    res.render("index");
  });
});

Server.listen();
