//const SerialPort = require("chrome-apps-serialport").SerialPort;
//const SerialPort = require('serialport').SerialPort
//const Firmata = require("firmata-io")(SerialPort);
const five = require('johnny-five');

var _priv = {
    board: null,
    config: null,
    leds: {}
}

const _helpers = {
    _init2: async function () {
        //        let ports = await SerialPort.list();
        //        console.log("HERE da ports ", ports);
        /*
        SerialPort.list().then(ports => {

            console.log("HERE da ports ", ports);


            const device = ports.find(port => {
                console.log("DA PORT IS ", port);
                return port.manufacturer && port.manufacturer.startsWith("Arduino");
            });

            console.log("HERE is the device", device);
            const board = new five.Board({
                io: new Firmata(device.path)
            })

            _helpers._init(board);
        })
        */
    },
    _getMotorPins: function (name, motorname) {
        const invertPWM = false;

        // cdir
        /*
                pins: {
                    pwm: 9,
                        dir: 8,
                            cdir: 7
                },
        */
        let motors = {
            left: {
                pins: {
                    pwm: 10,
                    dir: 8,
                    cdir: 7
                },
                invertPWM
            },
            right: {
                pins: {
                    pwm: 3,
                    dir: 4,
                    cdir: 5
                },
                invertPWM
            }
        }

        let ret = null;
        if (motorname == "both") {
            ret = [];
            for (let m in motors) {
                ret.push(motors[m]);
            }
        }

        console.log("GOT motor setup for " + motorname, ret);
        return ret;
    },
    _testing: function () {
        let minfo = _helpers._getMotorPins('Robot A', 'both');
        let motors = new five.Motors(minfo)

        if (!motors) {
            console.error("ERROR getting motor setup!!!");
            return;
        }

        _priv.board.repl.inject({
            motors
        });

        console.log("GO FORWARD");
        // motors[1] is RIGHT
        motors.forward(255);
        _priv.board.wait(5000, () => {
            console.log("GO BACK...");
            motors.reverse(255);
            _priv.board.wait(5000, () => {
                console.log("STOIPPING NOW...");
                motors.stop();
            })
        });

    },
    _getRobotInfo: function () {
        let boardinfo = _priv.config.getConfigData("robots")
    },
    _init: function (board) {
        console.log("Calling init of board", board);
        if (board) {
            _priv.board = board;
        } else {
            _priv.board = new five.Board();
            //                port: 'COM3',
            //                repl: false
            //            });
        }

        _priv.board.on("ready", function () {

            console.log("arduino board is now ready");
            _helpers._doLED('LEDBLINK', 7, 100);
        });
    },
    _doLED: function (cmdtype, pin, tlen) {
        let led = _priv.leds[pin];
        if (!led) {
            led = new five.Led(pin);
            _priv.leds[pin] = led;
        } else {
            led.stop();
        }
        let bRet = true;
        switch (cmdtype) {
            case 'LEDBLINK':
            case 'BLINK':
                led.blink(tlen);
                break;
            case 'LEDOFF':
                led.off();
                break;
            case 'LEDON':
                led.on();
                break;
            default:
                console.error("Unreocgnized command!", cmdtype);
                bRet = false;
                break;
        }
        return bRet;
    },
    _executeCommand: function (cmd) {
        if (!cmd) {
            console.error("ERROR - cmd not set");
            return;
        }
        cmd.trim();
        let cmda = cmd.split("-");

        let pin, led, tlen;

        console.log("RUNNING COMMAND:" + cmd + ":");
        let bRet = true;

        switch (cmda[0]) {
            case 'FWD':

            case 'LEDON':
            case 'LEDOFF':
                pin = parseInt(cmda[1], 10);
                console.log("HERE is a " + cmda[0] + " command with pin " + pin);
                bRet = _helpers._doLED(cmda[0], pin);
                break;
            case 'BLINK':
            case 'LEDBLINK':
                // expects of form BLINK-PIN-TIME
                // where: 
                //  PIN is the pin number 
                //  TIME is the blink time in ms
                if (cmda.length !== 3) {
                    console.error("ERROR - invalid BLINK: " + cmd);
                    return false;
                }
                pin = parseInt(cmda[1], 10);
                tlen = parseInt(cmda[2], 10);
                console.log("HERE is a blink command with pin " + pin + " and time " + tlen)
                bRet = _helpers._doLED(cmda[0], pin, tlen);
                break
            default:
                console.log("Unsupported cmd " + cmda[0]);
                bRet = false;
                break;
        }

        return bRet;
    }
}

const arduino = {
    init: function (config) {
        _priv.config = config;
        _helpers._init();
    },
    testing: function () {
        _helpers._testing();
    },
    executeCommands: function (user, commands) {
        if (!_priv.board) {
            console.log("BOARD not initialized!");
            return;
        }
        console.log("executeCommands", commands, user);

        if (!commands) {
            return;
        }

        const cmda = commands.split(",");

        for (let cmd of cmda) {
            _helpers._executeCommand(cmd);
        }
    }
}

// export default arduino

module.exports = arduino