// Manages forked processes that requires heavy work,
// this can be used to fork webtorrent downloads.
// and uploads

import { EventEmitter } from "events";
import { ChildProcess, fork } from "child_process";

export const THREAD_MANAGER_EVENTS = {
  CHILD_MESSAGE: "CHILD_MESSAGE",
  CHILD_ERROR: "CHILD_ERROR",
  CHILD_DISCONNECT: "CHILD_DISCONNECT",
};

type THREAD_MANAGER_EVENTS =
  typeof THREAD_MANAGER_EVENTS[keyof typeof THREAD_MANAGER_EVENTS];

export default class ThreadManager2 extends EventEmitter {
  public threads: Map<number, ChildProcess>;
  public size: number;
  public maxThreads: number;

  constructor(max: number = 50) {
    super();

    this.threads = new Map<number, ChildProcess>();
    this.size = this.threads.size;
    this.maxThreads = max;
  }

  /**
   * Fork n threads
   * @param {number} n - number of threads to start
   * @param {string} script - the script to be executed in the thread
   * @param {*} [metadata] - metadata the script needs to execute
   * @returns {Promise<Array<number>>} - an array of the pids
   */
  public async fork(
    n: number,
    script: string,
    metadata: any
  ): Promise<Array<number>> {
    if (this.size + n > this.maxThreads)
      throw new Error(
        "Maximum number of threads has been reached, queue the forking for later."
      );

    let forkedPids = new Array<number>(n),
      self = this;

    function onMessage(msg) {
      self.emit(THREAD_MANAGER_EVENTS.CHILD_MESSAGE, msg);
    }

    function onError(err) {
      self.emit(THREAD_MANAGER_EVENTS.CHILD_ERROR, err);
      self._clean();
    }

    function onDisconnect() {
      self.emit(THREAD_MANAGER_EVENTS.CHILD_DISCONNECT);
      self._clean();
    }

    for (let i = 0; i < n; i++) {
      let child = fork(script);
      child.on("message", onMessage);
      child.on("error", onError);
      child.on("disconnect", onDisconnect);

      if (metadata) child.send(metadata);

      self.threads.set(child.pid, child);
      self.size = self.threads.size;
      forkedPids[i] = child.pid;
    }

    return forkedPids;
  }

  private _clean() {
    let self = this;
    let toDelete = [];
    this.threads.forEach((child, pid, __) => {
      if (!child.connected && !child.killed) {
        child.kill();
        toDelete.push(pid);
      }
    });

    toDelete.forEach((pid) => {
      self.threads.delete(pid);
    });

    this.size = this.threads.size;
  }
}
