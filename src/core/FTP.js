// FTP instance,
// handles the uploads to push zone

const ftp = require("ftp");
const { createWriteStream } = require("fs");
const { join } = require("path");
const { EventEmitter } = require("events");

const FTP_STATES = {
  IDLE: "IDLE",
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  READY: "READY",
  CLOSED: "CLOSED",
  ERROR: "ERRRO",
  ENDED: "ENDED",
};

const FTP_EVENTS = {
  FTP_READY: "FTP_READY",
};

const FTP_CLIENT_EVENTS = {
  ready: "ready",
  greeting: "greeting",
  error: "error",
  close: "close",
  end: "end",
};

/**
 * @param {object} opt
 * @param {ftp.Options} opt.ftpOptions
 * @param {string} opt.downloadDir
 */
function FTP(opt) {
  this.__clientOptions = opt.ftpOptions;
  this.__downloadDir = opt.downloadDir;

  this.client = new ftp();
  this.connected = false;
  this.closed = true;

  this.state = FTP_STATES.IDLE;

  this.__init();
}

FTP.prototype = Object.create(EventEmitter.prototype);
FTP.prototype.constructor = FTP;

/**
 *
 * @param {ftp.Options} [opt]
 */
FTP.prototype.connect = function (opt) {
  this.setState(FTP_STATES.CONNECTING);

  this.client.connect(opt ?? this.__clientOptions);
};

FTP.prototype.__init = function () {
  const self = this;

  if (!(this.client instanceof ftp)) {
    this.client = new ftp();
  }
  this.client.on(FTP_CLIENT_EVENTS.greeting, (msg) => {
    self.setState(FTP_STATES.CONNECTED);
    self.connected = true;
    self.closed = false;
    console.log(`FTP client connected`);
    console.log(`Greeting from FTP server:`);
    console.log(msg);
  });

  this.client.on(FTP_CLIENT_EVENTS.error, (err) => {
    self.setState(FTP_STATES.ERROR);
    self.connected = false;
    self.closed = true;
    console.error(err);
  });

  this.client.on(FTP_CLIENT_EVENTS.close, (hadError) => {
    self.setState(FTP_STATES.CLOSED);
    self.connected = false;
    self.closed = true;
    if (hadError) {
      console.log("FTP client closed due to an error");
      self.setState(FTP_STATES.ERROR);
    }
    console.log("FTP client fully closed");
  });

  this.client.on(FTP_CLIENT_EVENTS.end, () => {
    self.setState(FTP_STATES.ENDED);
    self.connected = false;
    self.closed = true;
    console.log("FTP client connection has ended");
  });

  this.client.on(FTP_CLIENT_EVENTS.ready, () => {
    self.setState(FTP_STATES.READY);
    self.emit(FTP_EVENTS.FTP_READY);
  });
};

/**
 *
 * @param {string} state
 */
FTP.prototype.setState = function (state) {
  this.state = state;
};

/**
 *
 * @returns {boolean}
 */
FTP.prototype.isReady = function () {
  return this.state === FTP_STATES.READY && this.connected;
};

/**
 *
 * @param {import('fs').ReadStream || Buffer || string} input
 * @param {string} destPath - include filename if it is a file.
 * @returns {Promise<void>}
 */
FTP.prototype.upload = function (input, destPath) {
  const self = this;
  return new Promise((resolve, reject) => {
    self.client.put(input, destPath, false, (err) => {
      if (err) return reject(err);

      return resolve();
    });
  });
};

/**
 *
 * @param {string} remotePath
 * @param {string} saveName
 * @returns {Promise<string>}
 */
FTP.prototype.download = function (remotePath, saveName) {
  const self = this;
  return new Promise((resolve, reject) => {
    self.client.get(remotePath, (err, stream) => {
      if (err) return reject(err);

      const savePath = join(self.__downloadDir, saveName);
      const writeStream = createWriteStream(savePath);

      stream.once("close", () => resolve(savePath));

      stream.pipe(writeStream);
    });
  });
};

/**
 *
 * @returns {Promise<void>}
 */
FTP.prototype.abort = function () {
  const self = this;
  return new Promise((resolve, reject) => {
    self.client.abort((err) => {
      if (err) return reject(err);

      resolve();
    });
  });
};

/**
 *
 * @returns {Promise<string>}
 */
FTP.prototype.status = function () {
  const self = this;
  return new Promise((resolve, reject) => {
    self.client.status((err, serverStatus) => {
      if (err) return reject(err);

      resolve(serverStatus);
    });
  });
};

FTP.prototype.end = function () {
  return this.client.end();
};

FTP.prototype.destroy = function () {
  return this.client.destroy();
};

FTP.prototype.__cleanUp = function () {
  if (this.client instanceof ftp) {
    this.destroy();
    this.client.logout((err) => {
      console.log("Error trying to logout from FTP server");
      console.log(err);
    });
  }

  this.client = null;
  this.connected = false;
  this.closed = true;

  this.setState(FTP_STATES.IDLE);
};

module.exports = {
  FTP,
  FTP_EVENTS,
  FTP_STATES,
  FTP_CLIENT_EVENTS,
};
