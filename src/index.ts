// entry point
import { config } from "dotenv";
import path from "path";
import Server from "./core/Server";
import FTP, { FTP_EVENTS } from "./core/FTP";
import { static as eStatic, urlencoded } from "express";

// load env
config();

// initialize server instance
const server = new Server({
  port: Number(process.env.PORT) || 5555,
  extraHeaders: {
    "Server-Agent": "movify",
  },
});

// initialize FTP instance
const ftp = new FTP({
  ftpOptions: {
    host: process.env.FTP_HOST || "localhost",
    port: Number(process.env.FTP_PORT) || 21,
    user: process.env.FTP_USER || "anonymous",
    password: process.env.FTP_PASSWORD || "anonymous@",
  },
  downloadDir: path.join(__dirname, "downloads"),
});

ftp.on(FTP_EVENTS.FTP_READY, () => {
  console.log("FTP READY");
});

// Uncomment to connect FTP client to CDN
// FTP.connect();

server.configure((app) => {
  // set views
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  // Store FTP instance to make uploads to CDN
  // app.set("FTP", FTP);

  app.use("/public", eStatic(path.join(__dirname, "public")));
  app.use(urlencoded({ extended: true }));

  // ! debug only
  app.get("/", (_, res) => {
    res.render("index");
  });
});

server.configureSocket((io, namespaces) => {
  server.setNamespace("/movie-space");

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

server.listen();
