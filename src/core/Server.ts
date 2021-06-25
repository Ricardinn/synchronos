// server intance
import express from "express";
import { createServer, Server as httpServer } from "http";
import { EventEmitter } from "events";
import socketio from "socket.io";

type ServerOptions = {
  protocol?: string;
  enableSocket?: boolean;
  socketOptions?: Partial<socketio.ServerOptions>;
  port?: number;
  extraHeaders?: object;
};

type listenCallback = (port: number) => void;

type serverConfigureFunction = (app: express.Express) => void;

type socketConfigureFunction = (
  socket: socketio.Server,
  namespaces: Map<string, socketio.Namespace>
) => void;

type socketListener = (...args: any[]) => void;

export default class Server extends EventEmitter {
  public serverOptions: ServerOptions;
  public app: express.Express;
  public server: httpServer;
  public io: socketio.Server;

  private _localStorage = new Map<string, any>();
  private _socketNamespaces = new Map<string, socketio.Namespace>();

  /**
   * Server instance
   * Inherits EventEmitter prototype
   * @param {ServerOptions} opt
   * @param {string} [opt.protocol = "http"] - defualt http protocol
   * @param {boolean} [opt.enableSocket = true] - default to true
   * @param {Partial<socketio.ServerOptions>} [opt.socketOptions]
   * @param {number} [opt.port = 5555] - default 5555
   * @param {object} [opt.extraHeaders] - extra headers to be passed http responses.
   */
  constructor(opt: ServerOptions) {
    super();

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

    this.io = new socketio.Server();
    this.io.attach(this.server, this.serverOptions.socketOptions);

    this._socketNamespaces.set("/", this.io.of("/"));
  }

  /**
   * Start listening on specified port.
   * @param {listenCallback} [cb]
   */
  public listen(cb?: listenCallback) {
    cb = cb ?? ((port) => console.log(`Listening on port: ${port}`));
    let self = this;
    this.server.listen(this.serverOptions.port, () => {
      cb(self.serverOptions.port);
      self = null;
    });
  }

  /**
   * Configures the Server.
   * In the callback function, register all middlewares,
   * routes, and among other things for the Server to run correctly.
   * @param {serverConfigureFunction} fn
   */
  public configure(fn: serverConfigureFunction) {
    // use the provided function to configure the express app
    // an instance of the express app is referenced as a param
    fn(this.app);
  }

  /**
   * Use middleware.
   * @param  {...express.RequestHandler} handlers
   */
  public use(...handlers) {
    this.app.use(...handlers);
  }

  /**
   * Set key, value pair in Express Application
   * @param {string} key
   * @param {*} value
   */
  public set(key: string, value: any) {
    this.app.set(key, value);
  }

  /**
   * Get value stored in Express Application or set 'GET' method route
   * @param {string} key
   * @param {...express.RequestHandler[]} handlers
   */
  public get(key: string, ...handlers: express.RequestHandler[]) {
    if (handlers.length) {
      // set get method route
      this.app.get(key, ...handlers);
    } else {
      // getting a value from the express application
      this.app.get(key);
    }
  }

  /**
   * Set 'POST' method route
   * @param {string} route
   * @param  {...express.RequestHandler[]} handlers
   */
  public post(route: string, ...handlers: express.RequestHandler[]) {
    return this.app.post(route, ...handlers);
  }

  /**
   * Set key, value pair to Server instance
   * @param {string} key
   * @param {*} value
   */
  public localSet(key: string, value: any) {
    // stores key, value pair in Server instance instead of express app.
    this._localStorage.set(key, value);
  }

  /**
   * Get a value stored in the Server instance
   * @param {string} key
   * @returns {(any|undefined)}
   */
  public localGet(key: string): any | undefined {
    return this._localStorage.get(key);
  }

  /**
   * Creates a new namespace for the Socket
   * @param {string} path - the path for the namespace
   * @returns {boolean} - successfully created returns true, otherwise false
   */
  public setNamespace(path: string) {
    if (!this.io) return false; // do not proceed if no socket is initialized

    this._socketNamespaces.set(path, this.io.of(path));

    return true;
  }

  /**
   *
   * @param {string} path - the name use to store the namespace
   * @returns {(socketio.Namespace|undefined)}
   */
  public getNamespace(path: string): socketio.Namespace | undefined {
    if (!this.io) return undefined;

    return this._socketNamespaces.get(path);
  }

  /**
   * Configures the socket instance.
   * The callback receives two parameters,
   * the socket and the Map of namespaces.
   * Configure all the events and namespaces logic in the callback.
   * @param {socketConfigureFunction} fn
   */
  public configureSocket(fn: socketConfigureFunction) {
    fn(this.io, this._socketNamespaces);
  }

  // /**
  //  * @callback socketListener
  //  * @param {...any} args
  //  */

  /**
   * Sets a listener to root socket.
   * @param {string} eventName
   * @param {socketListener} listener
   */
  public socketOn = function (eventName: string, listener: socketListener) {
    this.io.on(eventName, listener);
  };

  /**
   * Sets a listener to root socket that only listens one time.
   * @param {string} eventName
   * @param {socketListener} listener
   */
  public socketOnce = function (eventName: string, listener: socketListener) {
    this.io.once(eventName, listener);
  };

  /**
   * Emit event using root socket
   * @param {string} eventName
   * @param  {...any[]} args
   */
  public sokcetEmit = function (eventName: string, ...args: any[]) {
    this.io.emit(eventName, ...args);
  };

  /**
   * Broadcast to all local sockets
   * @param {string} eventName
   * @param  {...any[]} args
   */
  public socketBroadcast(eventName: string, ...args: any[]) {
    this.io.local.emit(eventName, ...args);
  }
}
