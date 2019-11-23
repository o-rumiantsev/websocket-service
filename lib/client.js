'use strict';

const websocket = require('websocket');
const EventEmitter = require('events');

const { OutgoingConnection } = require('./connection');

const RECONNECT_INTERVAL = 1000;

const connect = (address, tlsOptions) => {
  const client = new websocket.client({ tlsOptions });
  client.connect(address, 'echo-protocol');
  return new Promise(resolve => {
    client.once('connect', resolve);
    client.on('connectFailed', () => resolve(null));
  });
};

class Client extends EventEmitter {
  address;
  tlsOptions;
  connection;
  shouldReconnect = true;
  callId = 1;

  constructor(address, tlsOptions = {}) {
    super();
    this.address = address;
    this.tlsOptions = tlsOptions;
  }

  async connect() {
    const connection = await connect(this.address, this.tlsOptions);
    if (!connection) {
      setTimeout(
        () => this.shouldReconnect && this.connect(),
        RECONNECT_INTERVAL
      );
    } else {
      this.connection = new OutgoingConnection(connection);
      this.connection.on('message', data => {
        if (data.error && !data.callId) {
          this.emit('error', data.error);
        }
      });
      this.emit('connect');
    }
  }

  close() {
    this.shouldReconnect = false;
    this.connection.close(() => this.emit('close'));
  }

  callProcedure(procedureName, params) {
    const callObject = {
      callId: this.callId++,
      procedureName,
      params,
    };

    this.connection.json(callObject);
    return new Promise((resolve, reject) => {
      const onResponse = data => {
        if (data.callId === callObject.callId) {
          this.connection.off('message', onResponse);
          data.error ? reject(data.error) : resolve(data.result);
        }
      };

      this.connection.on('message', onResponse);
    });
  }

  service() {
    return new Proxy(
      {},
      {
        get: (target, prop) => (...args) => this.callProcedure(prop, args),
      }
    );
  }
}

module.exports = Client;
