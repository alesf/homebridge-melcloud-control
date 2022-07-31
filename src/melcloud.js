const fs = require('fs');
const fsPromises = fs.promises;
const EventEmitter = require('events');
const axios = require('axios');
const API_URL = require('./apiurl.json');
const CONSTANS = require('./constans.json');
const {
    setInterval
} = require('timers/promises');

class MELCLOUD extends EventEmitter {
    constructor(config) {
        super();
        const accountName = config.name;
        const user = config.user;
        const passwd = config.passwd;
        const language = config.language;
        const debugLog = config.debugLog;
        const prefDir = config.prefDir;
        const melCloudInfoFile = `${prefDir}/${accountName}_Account`;
        const melCloudBuildingsFile = `${prefDir}/${accountName}_Buildings`;
        this.emitDeviceInfo = false;

        this.axiosInstanceLogin = axios.create({
            method: 'POST',
            baseURL: API_URL.BaseURL,
            timeout: 10000
        });


        this.on('connect', async () => {
                const options = {
                    data: {
                        AppVersion: '1.22.10.0',
                        CaptchaChallenge: '',
                        CaptchaResponse: '',
                        Email: user,
                        Password: passwd,
                        Language: language,
                        Persist: 'true'
                    }
                };

                try {
                    const loginData = await this.axiosInstanceLogin(API_URL.ClientLogin, options);
                    const melCloudInfoData = JSON.stringify(loginData.data, null, 2);
                    const debug = debugLog ? this.emit('debug', `Account ${accountName}, debug melCloudInfo: ${melCloudInfoData}`) : false;
                    const debug1 = debugLog ? this.emit('debug', `Account ${accountName}, Connected.`) : false;
                    const writeMelCloudInfoData = await fsPromises.writeFile(melCloudInfoFile, melCloudInfoData);
                    const melCloudInfo = loginData.data.LoginData;
                    const contextKey = loginData.data.LoginData.ContextKey;
                    this.melCloudInfo = melCloudInfo;
                    this.contextKey = contextKey;

                    if (contextKey != undefined && contextKey != null) {
                        this.emitDeviceInfo = true;
                        this.emit('checkDevicesList')
                    } else {
                        this.emit('message', `Account ${accountName}, context key not found, reconnect in 60s.`)
                        this.reconnect();
                    };
                } catch (error) {
                    this.emit('error', `Account: ${accountName}, login error, ${error}, reconnect in 60s.`);
                    this.reconnect();
                };
            })
            .on('checkDevicesList', async () => {
                const debug = debugLog ? this.emit('debug', `Account ${accountName}, Scanning for devices.`) : false;
                const melCloudInfo = this.melCloudInfo;
                const contextKey = this.contextKey;

                this.axiosInstanceGet = axios.create({
                    method: 'GET',
                    baseURL: API_URL.BaseURL,
                    timeout: 10000,
                    headers: {
                        'X-MitsContextKey': contextKey
                    }
                });

                try {
                    const listDevicesData = await this.axiosInstanceGet(API_URL.ListDevices);
                    const buildingsData = JSON.stringify(listDevicesData.data, null, 2);
                    const debug1 = debugLog ? this.emit('debug', `Account ${accountName}, debug buildings: ${buildingsData}`) : false;
                    const writeDevicesData = await fsPromises.writeFile(melCloudBuildingsFile, buildingsData);


                    //read building structure and get the devices
                    const buildingsList = listDevicesData.data;
                    const buildingsCount = buildingsList.length;
                    if (buildingsCount > 0) {
                        const devices = new Array();
                        for (let i = 0; i < buildingsCount; i++) {
                            const building = buildingsList[i];
                            const buildingStructure = building.Structure;

                            //floors
                            const floorsCount = buildingStructure.Floors.length;
                            for (let j = 0; j < floorsCount; j++) {
                                const floor = buildingStructure.Floors[j];

                                //floor areas
                                const florAreasCount = floor.Areas.length;
                                for (let l = 0; l < florAreasCount; l++) {
                                    const florArea = floor.Areas[l];

                                    //floor areas devices
                                    const florAreaDevicesCount = florArea.Devices.length;
                                    for (let m = 0; m < florAreaDevicesCount; m++) {
                                        const floorAreaDevice = florArea.Devices[m];
                                        devices.push(floorAreaDevice);
                                    };
                                };

                                //floor devices
                                const floorDevicesCount = floor.Devices.length;
                                for (let k = 0; k < floorDevicesCount; k++) {
                                    const floorDevice = floor.Devices[k];
                                    devices.push(floorDevice);
                                };
                            };

                            //building areas
                            const buildingAreasCount = buildingStructure.Areas.length;
                            for (let n = 0; n < buildingAreasCount; n++) {
                                const buildingArea = buildingStructure.Areas[n];

                                //building areas devices
                                const buildingAreaDevicesCount = buildingArea.Devices.length;
                                for (let o = 0; o < buildingAreaDevicesCount; o++) {
                                    const buildingAreaDevice = buildingArea.Devices[o];
                                    devices.push(buildingAreaDevice);
                                };
                            };

                            //building devices
                            const buildingDevicesCount = buildingStructure.Devices.length;
                            for (let p = 0; p < buildingDevicesCount; p++) {
                                const buildingDevice = buildingStructure.Devices[p];
                                devices.push(buildingDevice);
                            };
                        };

                        const devicesCount = devices.length;
                        const useFahrenheit = (melCloudInfo.UseFahrenheit == true) ? 1 : 0;
                        const temperatureDisplayUnit = CONSTANS.TemperatureDisplayUnits[useFahrenheit];

                        if (devicesCount > 0) {
                            const debug2 = debugLog ? this.emit('debug', `Account ${accountName}, Found: ${devicesCount} devices.`) : false;
                            const index = devicesCount - 1;
                            for (let i = 0; i < devicesCount; i++) {
                                const deviceInfo = devices[i];
                                const buildingId = deviceInfo.BuildingID.toString();
                                const deviceId = deviceInfo.DeviceID.toString();
                                const deviceType = deviceInfo.Type;
                                const deviceName = deviceInfo.DeviceName;
                                const deviceTypeText = CONSTANS.DeviceType[deviceType];

                                //wrire device info
                                const deviceData = JSON.stringify(deviceInfo, null, 2);
                                const melCloudBuildingDeviceFile = `${prefDir}/${accountName}_Device_${deviceId}`;
                                const writeDeviceInfoData = await fsPromises.writeFile(melCloudBuildingDeviceFile, deviceData);

                                if (this.emitDeviceInfo) {
                                    this.emit('checkDevicesListComplete', melCloudInfo, contextKey, buildingId, deviceInfo, deviceId, deviceType, deviceName, deviceTypeText, useFahrenheit, temperatureDisplayUnit);
                                    if (i == index) {
                                        this.emitDeviceInfo = false;
                                        this.checkDevicesList();
                                    };
                                } else {
                                    if (i == index) {
                                        this.checkDevicesList();
                                    };
                                };
                            };
                        } else {
                            this.emit('message', `Account ${accountName}, no devices found, check again in 60s.`)
                            this.checkDevicesList();
                        };
                    } else {
                        this.emit('message', `Account ${accountName}, no building found, check again in 60s.`)
                        this.checkDevicesList();
                    };
                } catch (error) {
                    this.emit('error', `Account ${accountName}, check devices list error, ${error}, check again in 60s.`);
                    this.checkDevicesList();
                };
            })
        this.emit('connect');
    };

    reconnect() {
        setTimeout(() => {
            this.emit('connect');
        }, 60000);
    };

    checkDevicesList() {
        setTimeout(() => {
            this.emit('checkDevicesList');
        }, 60000);
    };
};
module.exports = MELCLOUD;