/**
 * AQ:bit commands.
 */
enum HttpMethod {
    GET,
    POST,
    PUT,
    HEAD,
    DELETE,
    PATCH,
    OPTIONS,
    CONNECT,
    TRACE
}
enum BME280_I2C_ADDRESS {
    //% block="0x76"
    ADDR_0x76 = 0x76,
    //% block="0x77"
    ADDR_0x77 = 0x77
}

//% color=#4698CB weight=90 icon="\uf2c8" block="AQ:bit"
namespace AQbit {

    let watchdogIsActive = false
    let watchdogRunTime = input.runningTime()

    function serialToPMS(): void {
        serial.redirect(
            SerialPin.P1,
            SerialPin.P0,
            BaudRate.BaudRate9600
        )
    }

    function verifyBytes(response: Buffer): boolean {
        let checkCode = 256 * response[30] + response[31]
        return checkCode == (response[0] + response[1] + response[2] + response[3] + response[4]
            + response[5] + response[6] + response[7] + response[8] + response[9]
            + response[10] + response[11] + response[12] + response[13] + response[14]
            + response[15] + response[16] + response[17] + response[18] + response[19]
            + response[20] + response[21] + response[22] + response[23] + response[24]
            + response[25] + response[26] + response[27] + response[28] + response[29])
    }

    /**
     * Put PMS in passive mode.
     */
    //% weight=100
    //% blockId="aqb_pms_pasive" block="put PMS in passive mode"
    export function putPMSInPassiveMode(): void {
	pins.digitalWritePin(DigitalPin.P13, 1)
        serial.setRxBufferSize(32)
    }

    /**
     * Read PMS value.
     */
    //% weight=99
    //% blockId="aqb_read_pms" block="read PMS 2.5"
    export function readPMS(): number {
        watchdogRunTime = input.runningTime()
        watchdogIsActive = true
        serialToPMS()
        serial.setRxBufferSize(32)
        basic.pause(1000)
        let response = serial.readBuffer(32)
        if (verifyBytes(response)) {
            watchdogIsActive = false
            return response[13]
        } else {
            basic.pause(1000)
            response = serial.readBuffer(32)
            if (verifyBytes(response)) {
                watchdogIsActive = false
                return response[13]
            } else {
                watchdogIsActive = false
                return -1
            }
        }
        watchdogIsActive = false
    }


    let BME280_I2C_ADDR = BME280_I2C_ADDRESS.ADDR_0x76

    function setreg(reg: number, dat: number): void {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = dat;
        pins.i2cWriteBuffer(BME280_I2C_ADDR, buf);
    }

    function getreg(reg: number): number {
        pins.i2cWriteNumber(BME280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BME280_I2C_ADDR, NumberFormat.UInt8BE);
    }

    function getInt8LE(reg: number): number {
        pins.i2cWriteNumber(BME280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BME280_I2C_ADDR, NumberFormat.Int8LE);
    }

    function getUInt16LE(reg: number): number {
        pins.i2cWriteNumber(BME280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BME280_I2C_ADDR, NumberFormat.UInt16LE);
    }

    function getInt16LE(reg: number): number {
        pins.i2cWriteNumber(BME280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BME280_I2C_ADDR, NumberFormat.Int16LE);
    }

    let dig_T1 = getUInt16LE(0x88)
    let dig_T2 = getInt16LE(0x8A)
    let dig_T3 = getInt16LE(0x8C)
    let dig_P1 = getUInt16LE(0x8E)
    let dig_P2 = getInt16LE(0x90)
    let dig_P3 = getInt16LE(0x92)
    let dig_P4 = getInt16LE(0x94)
    let dig_P5 = getInt16LE(0x96)
    let dig_P6 = getInt16LE(0x98)
    let dig_P7 = getInt16LE(0x9A)
    let dig_P8 = getInt16LE(0x9C)
    let dig_P9 = getInt16LE(0x9E)
    let dig_H1 = getreg(0xA1)
    let dig_H2 = getInt16LE(0xE1)
    let dig_H3 = getreg(0xE3)
    let a = getreg(0xE5)
    let dig_H4 = (getreg(0xE4) << 4) + (a % 16)
    let dig_H5 = (getreg(0xE6) << 4) + (a >> 4)
    let dig_H6 = getInt8LE(0xE7)
    setreg(0xF2, 0x04)
    setreg(0xF4, 0x2F)
    setreg(0xF5, 0xAC)
    let T = 0
    let P = 0
    let H = 0

    function get(): void {
        let adc_T = (getreg(0xFA) << 12) + (getreg(0xFB) << 4) + (getreg(0xFC) >> 4)
        let var1 = (((adc_T >> 3) - (dig_T1 << 1)) * dig_T2) >> 11
        let var2 = (((((adc_T >> 4) - dig_T1) * ((adc_T >> 4) - dig_T1)) >> 12) * dig_T3) >> 14
        let t = var1 + var2
        T = ((t * 5 + 128) >> 8) / 100
        if (T > 0 && T - Math.trunc(T) > 0.25 && T - Math.trunc(T) < 0.75) {
            T = Math.trunc(T) + 0.5
        } else if (T < 0 && T - Math.trunc(T) < -0.25 && T - Math.trunc(T) > -0.75) {
            T = Math.trunc(T) - 0.5
        } else {
            T = Math.round(T)
        }
        var1 = (t >> 1) - 64000
        var2 = (((var1 >> 2) * (var1 >> 2)) >> 11) * dig_P6
        var2 = var2 + ((var1 * dig_P5) << 1)
        var2 = (var2 >> 2) + (dig_P4 << 16)
        var1 = (((dig_P3 * ((var1 >> 2) * (var1 >> 2)) >> 13) >> 3) + (((dig_P2) * var1) >> 1)) >> 18
        var1 = ((32768 + var1) * dig_P1) >> 15
        if (var1 == 0)
            return;
        let adc_P = (getreg(0xF7) << 12) + (getreg(0xF8) << 4) + (getreg(0xF9) >> 4)
        let _p = ((1048576 - adc_P) - (var2 >> 12)) * 3125
        _p = Math.idiv(_p, var1) * 2;
        var1 = (dig_P9 * (((_p >> 3) * (_p >> 3)) >> 13)) >> 12
        var2 = (((_p >> 2)) * dig_P8) >> 13
        P = Math.idiv(_p + ((var1 + var2 + dig_P7) >> 4), 100)
        let adc_H = (getreg(0xFD) << 8) + getreg(0xFE)
        var1 = t - 76800
        var2 = (((adc_H << 14) - (dig_H4 << 20) - (dig_H5 * var1)) + 16384) >> 15
        var1 = var2 * (((((((var1 * dig_H6) >> 10) * (((var1 * dig_H3) >> 11) + 32768)) >> 10) + 2097152) * dig_H2 + 8192) >> 14)
        var2 = var1 - (((((var1 >> 15) * (var1 >> 15)) >> 7) * dig_H1) >> 4)
        if (var2 < 0) var2 = 0
        if (var2 > 419430400) var2 = 419430400
        H = (var2 >> 12) >> 10
    }

    /**
     * Read BME temperature.
     */
    //% weight=98
    //% blockId="aqb_read_temperature" block="read BME temperature"
    export function readBMETemperature(): number {
        get()
        return T - 2
    }

    /**
     * Read humidity.
     */
    //% weight=97
    //% blockId="aqb_read_humidity" block="read humidity"
    export function readHumidity(): number {
	    get()
        return H
    }

    /**
     * Read pressure.
     */
    //% weight=96
    //% blockId="aqb_read_pressure" block="read pressure"
    export function readPressure(): number {
        get()
        return P
    }


    let pauseBaseValue: number = 100

    function writeToSerial(data: string, waitTime: number): void {
        serial.writeString(data + "\u000D" + "\u000A")
        if (waitTime > 0) {
            basic.pause(waitTime)
        }
    }

    function connectToWiFiBit(): void {
        serial.redirect(
            SerialPin.P16,
            SerialPin.P8,
            BaudRate.BaudRate115200
        )
        basic.pause(100)
    }

    /**
     * Connect to WiFi network.
     * @param ssid SSID, eg: "SSID"
     * @param key Key, eg: "key"
     */
    //% weight=95
    //% blockId="aqb_wifi_on" block="connect to WiFi network %ssid, %key"
    export function connectToWiFiNetwork(ssid: string, key: string): void {
        connectToWiFiBit()
        writeToSerial("AT+RST", 5000)
	    writeToSerial("AT+SLEEP=0", 2000)
	    writeToSerial("AT+RFPOWER=82", 2000)    
        writeToSerial("AT+CWMODE=1", 5000)
	    writeToSerial("AT+CWRECONNCFG=30,99", 5000)
	    writeToSerial("AT+CWJAP=\"" + ssid + "\",\"" + key + "\"", 15000)
    }

/*
    /**
     * Execute HTTP method.
     * @param method HTTP method, eg: HttpMethod.GET
     * @param host Host, eg: "google.com"
     * @param port Port, eg: 80
     * @param urlPath Path, eg: "/search?q=something"
     * @param headers Headers
     * @param body Body
     */
    //% weight=94
    //% blockId="aqb_http_method" block="execute HTTP method %method|host: %host|port: %port|path: %urlPath||headers: %headers|body: %body"
    function executeHttpMethod(method: HttpMethod, host: string, port: number, urlPath: string, headers?: string, body?: string): void {
	connectToWiFiBit()
        let myMethod: string
        switch (method) {
            case HttpMethod.GET: myMethod = "GET"; break;
            case HttpMethod.POST: myMethod = "POST"; break;
            case HttpMethod.PUT: myMethod = "PUT"; break;
            case HttpMethod.HEAD: myMethod = "HEAD"; break;
            case HttpMethod.DELETE: myMethod = "DELETE"; break;
            case HttpMethod.PATCH: myMethod = "PATCH"; break;
            case HttpMethod.OPTIONS: myMethod = "OPTIONS"; break;
            case HttpMethod.CONNECT: myMethod = "CONNECT"; break;
            case HttpMethod.TRACE: myMethod = "TRACE";
        }
        let data: string = "AT+CIPSTART=\"TCP\",\"" + host + "\"," + port
        writeToSerial(data, pauseBaseValue * 6)
        data = myMethod + " " + urlPath + " HTTP/1.1" + "\u000D" + "\u000A"
            + "Host: " + host + "\u000D" + "\u000A"
        if (headers && headers.length > 0) {
            data += headers + "\u000D" + "\u000A"
        }
        if (data && data.length > 0) {
            data += "\u000D" + "\u000A" + body + "\u000D" + "\u000A"
        }
        data += "\u000D" + "\u000A"
        writeToSerial("AT+CIPSEND=" + (data.length + 2), pauseBaseValue * 3)
        writeToSerial(data, pauseBaseValue * 6)
        writeToSerial("AT+CIPCLOSE", pauseBaseValue * 3)
    }

    /**
     * Write Blynk pin value.
     * @param value Value, eg: "510"
     * @param pin Pin, eg: "A0"
     * @param auth_token Token, eg: "14dabda3551b4dd5ab46464af582f7d2"
     */
    //% weight=93
    //% blockId="aqb_blynk_write" block="Blynk write %value to %pin, token is %auth_token"
    function writePinValue(value: string, pin: string, auth_token: string): void {
        executeHttpMethod(
            HttpMethod.GET,
            "blynk-cloud.com",
            80,
            "/" + auth_token + "/update/" + pin + "?value=" + value
        )
    }

    /**
     * Write Blynk pin value.
     * @param temperature Temperature, eg: 21.5
     * @param pressure Pressure, eg: 1024
     * @param humidity Humidity, eg: 52
     * @param PM Particulate matter, eg: 10
     * @param token Token, eg: "f58Xf7d2"
     */
    //% weight=92
    //% blockId="aqb_send_data" block="send data|temperature %temperature|pressure %pressure|humidity %humidity|PM %PM|token %token"
    export function sendData(temperature: number, pressure: number, humidity: number, PM: number, token: string): void {
        serial.setRxBufferSize(32)
	    executeHttpMethod(
            HttpMethod.GET,
            "134.209.242.221",
            80,
            "/communicate/?temperature=" + Math.trunc(temperature) + "&humidity=" + humidity + "&pressure=" + pressure + "&pm=" + PM + "&token=" + token
        )    
    }

    /**
     * Prevent sensor blocking.
     */
    //% weight=91
    //% blockId="aqb_watchdog" block="prevent sensor blocking"
    export function preventSensorBlocking(): void {
        while (true) {
                if (watchdogIsActive){
		    if (input.runningTime() - watchdogRunTime > 10000) {
			    control.reset()
		    }
                }
                basic.pause(100)
        }
    }

}
