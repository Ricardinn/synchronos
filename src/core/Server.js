// server intance
const express = require("express");
const { createServer } = require("http");
const { EventEmitter } = require("events");
const { Server: ioServer } = require("socket.io");

/**
 * Server instance
 * Inherits EventEmitter prototype
 * @param {object} opt
 * @param {string} [opt.protocol = "http"] - defualt http protocol
 * @param {boolean} [opt.enableSocket = true] - default to true
 * @param {object} [opt.socketOptions]
 * @param {number} [opt.port = 5555] - default 5555
 * @param {object} [opt.extraHeaders] - extra headers to be passed http responses.
 */
function Server(opt) {
  this.serverOptions = Object.assign(
    {
      port: 5555,
      protocol: "http",
      enableSocket: true,
      socketOptions: {
        path: "/socket.io",
        transports: ["websocket", "polling"], // normal sequence is ['polling', 'websocket']
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
        },
      },
    },
    opt
  );

  this.app = express();
  this.server = createServer(this.app);

  this.__localStorage = new Map();
  this.__socketNamespaces = new Map();

  if (this.serverOptions.enableSocket) {
    this.socket = new ioServer();
    this.socket.attach(this.server, this.serverOptions.socketOptions);
    this.__socketNamespaces.set("root", this.socket.of("/"));
  } else {
    this.socket = null;
  }

  if (this.serverOptions.extraHeaders) {
    this.app.use((req, res, next) => {
      res.set(this.serverOptions.extraHeaders);
      next();
    });
  }
}

Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;

Server.prototype.listen = function (cb) {
  // start listenning on set port
  cb =
    cb ??
    (() => console.log(`Listening on port: ${this.serverOptions.port}`)).bind(
      this
    );
  this.server.listen(this.serverOptions.port, cb);
};

Server.prototype.configure = function (fn) {
  // use the provided function to configure the express app
  // an instance of the express app is referenced as a param
  fn(this.app);
};

Server.prototype.use = function (...handlers) {
  this.app.use(...handlers);
};

/**
 * Set key, value pair in Express Application
 * @param {string} key
 * @param {*} value
 */
Server.prototype.set = function (key, value) {
  this.app.set(key, value);
};

/**
 * Get value stored in Express Application
 * @param {string} key
 * @returns
 */
Server.prototype.get = function (key) {
  return this.app.get(key);
};

/**
 * Set key, value pair to Server instance
 * @param {string} key
 * @param {*} value
 */
Server.prototype.localSet = function (key, value) {
  // stores key, value pair in Server instance instead of express app.
  this.__localStorage.set(key, value);
};

/**
 * Get a value stored in the Server instance
 * @param {string} key
 * @returns
 */
Server.prototype.localGet = function (key) {
  return this.__localStorage.get(key);
};

/**
 *
 * @param {string} path
 * @param {string} name
 * @returns {boolean}
 */
Server.prototype.setNamespace = function (path, name) {
  if (!this.socket) return false; // do not proceed if no socket is initialized

  if (!name) name = path;

  this.__socketNamespaces.set(name, this.socket.of(path));

  return true;
};

/**
 *
 * @param {string} name
 * @returns
 */
Server.prototype.getNamespace = function (name) {
  if (!this.socket) return false;

  return this.__socketNamespaces.get(name);
};

/**
 *
 * @param {Function} fn
 */
Server.prototype.configureSocket = function (fn) {
  fn(this.socket, this.__socketNamespaces, this);
};

module.exports = Server;
