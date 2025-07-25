const EventEmitter = require("events");

export class UriEventHandler extends EventEmitter<any> {
  public handleUri(uri: any) {
    this.fire(uri);
  }
}
