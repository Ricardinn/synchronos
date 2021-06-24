// server intance
const express = require("express");
const { createServer } = require("http");
const { EventEmitter } = require("events");
const io = require("socket.io");

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
    this.socket = new io.Server();
    this.socket.attach(this.server, this.serverOptions.socketOptions);
    this.__socketNamespaces.set("root", this.socket.of("/"));
  } else {
    this.socket = null;
  }

  if (this.serverOptions.extraHeaders) {
    this.use(
      ((_, res, next) => {
        res.set(this.serverOptions.extraHeaders);
        next();
      }).bind(this)
    );
  }
}

// inherit EventEmitter
Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;

/**
 * @callback listenCallback
 * @param {number} port
 */

/**
 * Start listening on specified port.
 * @param {listenCallback} [cb]
 */
Server.prototype.listen = function (cb) {
  // start listenning on set port
  cb = cb ?? ((port) => console.log(`Listening on port: ${port}`));
  const self = this;
  this.server.listen(this.serverOptions.port, () => {
    cb(self.serverOptions.port);
  });
};

/**
 * @callback serverConfigureFunction
 * @param {express.Express} app
 */

/**
 * Configures the Server.
 * In the callback function, register all middlewares,
 * routes, and among other things for the Server to run correctly.
 * @param {serverConfigureFunction} fn
 */
Server.prototype.configure = function (fn) {
  // use the provided function to configure the express app
  // an instance of the express app is referenced as a param
  fn(this.app);
};

/**
 * Use middleware.
 * @param  {...express.RequestHandler} handlers
 */
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
 * Get value stored in Express Application or set 'GET' method route
 * @param {string} key
 * @param {...express.RequestHandler} handlers
 */
Server.prototype.get = function (key, ...handlers) {
  if (handlers.length) {
    // set get method route
    this.app.get(key, ...handlers);
  } else {
    // getting a value from the express application
    this.app.get(key);
  }
};

/**
 * Set 'POST' method route
 * @param {string} route
 * @param  {...express.RequestHandler} handlers
 */
Server.prototype.post = function (route, ...handlers) {
  return this.app.post(route, ...handlers);
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
 * @returns {*}
 */
Server.prototype.localGet = function (key) {
  return this.__localStorage.get(key);
};

/**
 * Creates a new namespace for the Socket
 * @param {string} path - the path for the namespace
 * @param {string} name - the name use to store the namespace in a Map
 * @returns {boolean} - successfully created returns true, otherwise false
 */
Server.prototype.setNamespace = function (path, name) {
  if (!this.socket) return false; // do not proceed if no socket is initialized

  if (!name) name = path;

  this.__socketNamespaces.set(name, this.socket.of(path));

  return true;
};

/**
 *
 * @param {string} name - the name use to store the namespace
 * @returns {(io.Server|undefined)}
 */
Server.prototype.getNamespace = function (name) {
  if (!this.socket) return false;

  return this.__socketNamespaces.get(name);
};

/**
 * @callback socketConfigureFunction
 * @param {io.Server} socket
 * @param {Map<string, io.Server>} namespaces
 */

/**
 * Configures the socket instance.
 * The callback receives two parameters,
 * the socket and the Map of namespaces.
 * Configure all the events and namespaces logic in the callback.
 * @param {socketConfigureFunction} fn
 */
Server.prototype.configureSocket = function (fn) {
  fn(this.socket, this.__socketNamespaces);
};

/**
 * @callback socketListener
 * @param {...any} args
 */

/**
 * Sets a listener for a socket event.
 * @param {string} eventName
 * @param {socketListener} listener
 */
Server.prototype.socketOn = function (eventName, listener) {
  this.socket.on(eventName, listener);
};

/**
 * Sets a listener for a socket event that only listens one time.
 * @param {string} eventName
 * @param {socketListener} listener
 */
Server.prototype.socketOnce = function (eventName, listener) {
  this.socket.once(eventName, listener);
};

/**
 *
 * @param {string} eventName
 * @param  {...any} args
 */
Server.prototype.emit = function (eventName, ...args) {
  this.socket.emit(eventName, ...args);
};

module.exports = Server;
