"use strict";

const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');
const MelCloud = require('../src/melcloud.js')

class PluginUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    //connect
    this.onRequest('/connect', this.start.bind(this));

    //this MUST be called when you are ready to accept requests
    this.ready();
  };

  async start(payload) {
    const accountName = payload.accountName;
    const user = payload.user;
    const passwd = payload.passwd;
    const language = payload.language;
    const accountInfoFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Account`;
    const buildingsFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Buildings`;
    const deviceFile = `${this.homebridgeStoragePath}/melcloud/${accountName}_Device_`;

    try {
      let data = {};
      const melCloud = new MelCloud(user, passwd, language, accountInfoFile, buildingsFile, deviceFile, false, 0, true);
      const response = await melCloud.connect();
      const accountInfo = response.accountInfo;
      const contextKey = response.contextKey;
      const devices = await melCloud.chackDevicesList(contextKey);
      return data = {
        info: '',
        status: 0,
        data: devices
      };
    } catch (error) {
      return data = {
        info: error,
        status: 1
      };
    };
  };
};

(() => {
  return new PluginUiServer();
})();
