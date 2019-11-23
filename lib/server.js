'use strict';

const http = require('http');
const https = require('https');
const websocket = require('websocket');

const Service = require('./service');
const { IncomingConnection } = require('./connection');

class Server {
  service;
  instance;
  httpServer;
  verifyOrigin = () => true;

  constructor({ service = new Service(), tlsOptions } = {}) {
    this.service = service;

    this.httpServer = tlsOptions
      ? https.createServer(tlsOptions)
      : http.createServer();

    this.instance = new websocket.server({
      httpServer: this.httpServer,
      autoAcceptConnections: false,
    });

    this.instance.on('request', request => this.onRequest(request));
  }

  setOriginPolicy(verifyOrigin) {
    this.verifyOrigin = verifyOrigin;
    return this;
  }

  onRequest(request) {
    if (!this.verifyOrigin(request.origin)) {
      request.reject();
      return;
    }

    const connection = new IncomingConnection(
      request.accept('echo-protocol', request.origin)
    );

    connection.on('call', async ({ callId, procedureName, params }) => {
      const procedure = this.service.api[procedureName];

      if (!procedure) {
        connection.callError(callId, 'Procedure does not exist');
        return;
      }

      try {
        const result = await procedure(this.service.store, ...params);
        connection.json({ callId, result });
      } catch (err) {
        connection.callError(callId, err.message);
      }
    });

    return connection;
  }

  listen(...args) {
    this.httpServer.listen(...args);
    return this;
  }
}

module.exports = Server;
