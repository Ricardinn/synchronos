// FTP instance,
// handles the uploads to push zone

import ftp from "ftp";
import { createWriteStream, ReadStream, write } from "fs";
import { join } from "path";
import { EventEmitter } from "events";

export const FTP_STATES = {
  IDLE: "IDLE",
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  READY: "READY",
  CLOSED: "CLOSED",
  ERROR: "ERRRO",
  ENDED: "ENDED",
};

type FTP_STATES = typeof FTP_STATES[keyof typeof FTP_STATES];

export const FTP_EVENTS = {
  FTP_READY: "FTP_READY",
};

type FTP_EVENTS = typeof FTP_EVENTS[keyof typeof FTP_EVENTS];

export const FTP_CLIENT_EVENTS = {
  ready: "ready",
  greeting: "greeting",
  error: "error",
  close: "close",
  end: "end",
};

type FTP_CLIENT_EVENTS =
  typeof FTP_CLIENT_EVENTS[keyof typeof FTP_CLIENT_EVENTS];

type FTPOptions = {
  ftpOptions: ftp.Options;
  downloadDir: string;
};

type UploadInput = ReadStream | Buffer | string;

export default class FTP extends EventEmitter {
  public client: ftp;
  public connected: boolean;
  public closed: boolean;
  public state: FTP_STATES;

  private _clientOptions: ftp.Options;
  private _downloadDir: string;

  /**
   * @param {FTPOptions} opt
   * @param {ftp.Options} opt.ftpOptions
   * @param {string} opt.downloadDir
   */
  constructor(opt: FTPOptions) {
    super();

    this._clientOptions = opt.ftpOptions;
    this._downloadDir = opt.downloadDir;

    this.client = new ftp();
    this.connected = false;
    this.closed = true;

    this.state = FTP_STATES.IDLE;

    this._init();
  }

  public connect(opt?: ftp.Options) {
    this.setState(FTP_STATES.CONNECTING);
    this.client.connect(opt ?? this._clientOptions);
  }

  public setState(state: FTP_STATES) {
    this.state = state;
  }

  get isReady() {
    return this.state === FTP_STATES.READY && this.connected;
  }

  public upload(input: UploadInput, destPath: string): Promise<void> {
    let self = this;
    return new Promise((resolve, reject) => {
      self.client.put(input, destPath, false, (err) => {
        self.end();
        self = null;
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  public download(
    remotePath: string,
    saveName: string,
    resolveStream: boolean = false
  ): Promise<string | NodeJS.ReadableStream> {
    let self = this;
    return new Promise((resolve, reject) => {
      self.client.get(remotePath, (err, stream) => {
        if (err) return reject(err);

        if (resolveStream) {
          resolve(stream);
        } else {
          let savePath = join(self._downloadDir, saveName);
          let writeStream = createWriteStream(savePath);

          stream
            .once("close", () => {
              self.end();
              resolve(savePath);
            })
            .pipe(writeStream);
        }
      });
    });
  }

  public abort(): Promise<void> {
    let self = this;
    return new Promise((resolve, reject) => {
      self.client.abort((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public status(): Promise<string> {
    let self = this;
    return new Promise((resolve, reject) => {
      self.client.status((err, serverStatus) => {
        if (err) return reject(err);
        resolve(serverStatus);
      });
    });
  }

  public end() {
    return this.client.end();
  }

  public destroy() {
    return this.client.destroy();
  }

  public cleanUp() {
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
  }

  private _init() {
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
  }
}
