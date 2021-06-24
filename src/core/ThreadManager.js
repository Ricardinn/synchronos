// Manages forked processes that requires heavy work,
// this can be used to fork webtorrent downloads.
// and uploads

const { EventEmitter } = require("events");
const { fork } = require("child_process");

const THREAD_MANAGER_EVENTS = {
  CHILD_MESSAGE: "CHILD_MESSAGE",
  CHILD_ERROR: "CHILD_ERROR",
  CHILD_DISCONNECT: "CHILD_DISCONNECT",
};

/**
 * @param {number} max - maximum number of threads to be forked at the same time.
 */
function ThreadManager(max = 50) {
  this.threads = new Map();
  this.size = this.threads.size;
  this.maxThreads = max;
}

ThreadManager.prototype = Object.create(EventEmitter.prototype);
ThreadManager.prototype.constructor = ThreadManager;

/**
 * Fork n threads
 * @param {number} n - number of threads to start
 * @param {string} script - the script to be executed in the thread
 * @param {*} [metadata] - metadata the script needs to execute
 * @returns {Promise<Array<number>>} - an array of the pids
 */
ThreadManager.prototype.fork = async function (n, script, metadata) {
  if (this.size + n > this.maxThreads)
    throw new Error(
      "Maximum number of threads has been reached, queue the forking for later."
    );

  const forkedPids = new Array(n),
    self = this;

  function onMessage(msg) {
    self.emit(THREAD_MANAGER_EVENTS.CHILD_MESSAGE, msg);
  }

  function onError(err) {
    self.emit(THREAD_MANAGER_EVENTS.CHILD_ERROR, err);
    self.__clean();
  }

  function onDisconnect() {
    self.emit(THREAD_MANAGER_EVENTS.CHILD_DISCONNECT);
    self.__clean();
  }

  for (let i = 0; i < n; i++) {
    let child = fork(script);
    child.on("message", onMessage);
    child.on("error", onError);
    child.on("disconnect", onDisconnect);

    if (metadata) child.send(metadata);

    self.threads.set(child.pid, child);
    self.size += 1;
    forkedPids[i] = child.pid;
    child.connected;
  }

  return forkedPids;
};

/**
 * Clean up after a sudden disconnect or error
 */
ThreadManager.prototype.__clean = function () {
  let self = this;
  this.threads.forEach((_, pid, _) => {
    if (!self.__isConnected(pid) && !self.__isRunning(pid)) {
      // if process is not connected, delete from Map
      self.threads.delete(pid);
      self.size -= 1;
    }
  });
  self = null;
  return;
};

/**
 * Check whether the subprocess is running or not.
 * @param {number} pid
 * @returns {boolean}
 */
ThreadManager.prototype.__isRunning = function (pid) {
  return process.kill(pid, 0);
};

/**
 * Check whether the subprocess is connected or not.
 * @param {number} pid
 * @returns {(boolean|undefined)}
 */
ThreadManager.prototype.__isConnected = function (pid) {
  let child = this.threads.get(pid);

  return child?.connected;
};

module.exports = {
  ThreadManager,
  THREAD_MANAGER_EVENTS,
};
