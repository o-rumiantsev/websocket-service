'use strict';

const EventEmitter = require('events');

const isValidJSON = string => {
  try {
    JSON.parse(string);
    return true;
  } catch (err) {
    return false;
  }
};

class Connection extends EventEmitter {
  connection;

  constructor(connection) {
    super();
    this.connection = connection;
  }

  send(data) {
    this.connection.sendUTF(data.toString());
    return this;
  }

  json(obj) {
    return this.send(JSON.stringify(obj));
  }

  error(message) {
    return this.json({ error: message });
  }
}

class IncomingConnection extends Connection {
  constructor(connection) {
    super(connection);

    connection.on('message', async message => {
      const data =
        message.type === 'utf8'
          ? message.utf8Data
          : message.binaryData.toString();

      if (!isValidJSON(data)) {
        this.error('Invalid JSON format');
        return;
      }

      const { callId, procedureName, params } = JSON.parse(data);

      if (!callId || !procedureName) {
        this.error('Invalid Call format');
        return;
      }

      this.emit('call', { callId, procedureName, params });
    });
  }

  callError(callId, message) {
    return this.json({ callId, error: message });
  }
}

class OutgoingConnection extends Connection {
  constructor(connection) {
    super(connection);

    this.setMaxListeners(Infinity);

    connection.on('message', async message => {
      const data =
        message.type === 'utf8'
          ? message.utf8Data
          : message.binaryData.toString();

      if (!isValidJSON(data)) {
        return;
      }

      this.emit('message', JSON.parse(data));
    });
  }
}

module.exports = {
  IncomingConnection,
  OutgoingConnection,
};
