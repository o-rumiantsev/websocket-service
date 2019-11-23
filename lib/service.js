'use strict';

class Service {
  api;
  store;

  constructor(api = {}, store = new Map()) {
    this.api = api;
    this.store = store;
  }
}

module.exports = Service;
