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
const FTP = new (require("./core/FTP").FTP)({
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

// Uncomment to connect FTP client to CDN
// FTP.connect();

Server.configure((app) => {
  // set views
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  // Store FTP instance to make uploads to CDN
  app.set("FTP", FTP);

  app.use("/public", require("express").static(path.join(__dirname, "public")));
  app.use(require("express").urlencoded({ extended: true }));

  // ! debug only
  app.get("/", (_, res) => {
    res.render("index");
  });
});

Server.configureSocket((io, namespaces) => {
  Server.setNamespace("/movie-space");

  io.on("connection", (_socket) => {
    console.log('user connected to "/"');
    console.log("socket id: " + _socket.id);
    _socket.emit("greeting", "Connected to '/'...");

    _socket.on("disconnect", (__reason) => {
      console.log("user disconnected: " + _socket.id);
      console.log("reason: " + __reason);
    });
  });

  let movieSpace = namespaces.get("/movie-space");
  movieSpace.on("connection", (_socket) => {
    console.log('user connected to "/movie-space"');
    console.log("socket id: " + _socket.id);
    _socket.emit("greeting", 'Conneted to "/movie-space"');

    _socket.on("movie-space:join-room", (roomId) => {
      // todo: add logic to join movie room.
      // todo: perfom count check in room to determine the host
      _socket.join(roomId);
    });

    _socket.on("disconnect", (__reason) => {
      console.log("user disconnected: " + _socket.id);
      console.log("reason: " + __reason);
    });
  });
});

Server.listen();
