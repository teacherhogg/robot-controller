//const SerialPort = require("chrome-apps-serialport").SerialPort;
//const SerialPort = require('serialport').SerialPort
//const Firmata = require("firmata-io")(SerialPort);
const { response } = require('express');
const five = require('johnny-five');

var _priv = {
    boards: null,
    config: null,
    leds: null,
    motors: null
}

const _helpers = {
    _init: function () {
        let rsettings = _priv.config.getRobotSettings();
        console.log("Calling init of boards", rsettings);
        _priv.boards = new five.Boards(rsettings);

        _priv.boards.on("ready", function (info) {

            console.log("arduino boards are now ready", info);
        });
    },
    _setupLeds: function (robotname) {
        if (!_priv.leds) { _priv.leds = {}; }
        if (!_priv.leds[robotname]) {
            const linfo = _priv.config.getLedSettings(robotname);

            let lightL = new five.Led({
                board: _priv.boards.byId(robotname),
                pin: linfo.left
            });
            let lightR = new five.Led({
                board: _priv.boards.byId(robotname),
                pin: linfo.right
            });

            if (!lightL || !lightR) {
                console.error("ERROR getting LED setup!!! " + robotname);
                return;
            }

            _priv.leds[robotname] = {
                left: lightL,
                right: lightR
            }
        }
    },
    _setupMotors: function (robotname) {
        if (!_priv.motors) { _priv.motors = {}; }
        if (!_priv.motors[robotname]) {
            const minfo = _priv.config.getMotorSettings(robotname);

            let motorL = new five.Motor(minfo.left)
            let motorR = new five.Motor(minfo.right)

            if (!motorL || !motorR) {
                console.error("ERROR getting motor setup!!! " + robotname);
                return;
            }

            _priv.boards[robotname].repl.inject({
                motorL, motorR
            });

            _priv.motors[robotname] = {
                left: motorL,
                right: motorR
            }
        }
    },
    _runMotors: function (robotname, cmd, inspeed, time) {
        console.log("Running Motors on " + robotname + " " + cmd + " for " + time);
        _helpers._setupMotors(robotname);
        const motors = _priv.motors[robotname];

        return new Promise((resolve, reject) => {
            if (!motors || !motors.left || !motors.right) { reject(new Error('Missing Robot Motors')); }
            else {
                const motorL = motors.left;
                const motorR = motors.right;
                let corr = 0;
                let speed = inspeed;
                switch (cmd) {
                    case 'FWD':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.forward(speed + corr);
                        motorR.forward(speed - corr);
                        break;
                    case 'BACK':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.reverse(speed + corr);
                        motorR.reverse(speed - corr);
                        break;
                    case 'FWDL':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.forward(speed + corr);
                        break;
                    case 'BACKL':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.reverse(speed + corr);
                        break;
                    case 'FWDR':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorR.forward(speed - corr);
                        break;
                    case 'BACKR':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorR.reverse(speed - corr);
                        break;
                    case 'TURNL':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.reverse(speed + corr);
                        motorR.forward(speed - corr);
                        break;
                    case 'TURNR':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        motorL.forward(speed + corr);
                        motorR.reverse(speed - corr);
                        break;
                    default:
                        console.log("NO RECOGNIZED COMMAND! " + cmd);
                        reject(new Error("CMDERROR " + cmd));
                        return;
                }

                console.log("RUNNING CMD " + cmd + " at speed " + speed + " for time " + time);
                _priv.boards[robotname].wait(time, () => {
                    motorL.stop();
                    motorR.stop();
                    resolve('DONE');
                });
            }
        });
    },
    _testing: async function (query) {
        const robotname = 'A';
        _helpers._setupMotors(robotname);

        console.log("GO TESTING... ", query);
        let speed = 255;
        let time = 3000;
        let bTurns = false;

        if (query && query.speed) { speed = query.speed; }
        if (query && query.time) { time = query.time; }
        if (query && query.turn) { bTurns = true; }

        if (bTurns) {
            await _helpers._runMotors(robotname, 'TURNR', speed, time);
            await _helpers._runMotors(robotname, 'TURNL', speed, time);
        } else {
            await _helpers._runMotors(robotname, 'BACK', speed, time);
            await _helpers._runMotors(robotname, 'FWD', speed, time);
        }
    },
    _doLED: function (robotname, cmd, tlen) {
        _helpers._setupLeds(robotname);
        let leds = _priv.leds[robotname];
        if (!leds) {
            console.error("ERROR Leds not setup", robotname);
            return;
        }
        let bRet = true;
        switch (cmd) {
            case 'LEDBLINK':
            case 'BLINK':
                leds.left.blink(tlen);
                leds.right.blink(tlen);
                break;
            case 'LEDOFF':
                leds.left.off();
                leds.right.off();
                break;
            case 'LEDON':
                leds.left.on();
                leds.right.on();
                break;
            case 'LEDBLINKL':
            case 'BLINKL':
                leds.left.blink(tlen);
                break;
            case 'LEDOFFL':
                leds.left.off();
                break;
            case 'LEDONL':
                leds.left.on();
                break;
            case 'LEDBLINKR':
            case 'BLINKR':
                leds.right.blink(tlen);
                break;
            case 'LEDOFFR':
                leds.right.off();
                break;
            case 'LEDONR':
                leds.right.on();
                break;
            default:
                console.error("Unreocgnized command!", cmdtype);
                bRet = false;
                break;
        }
        return bRet;
    },
    _executeCommand: async function (robotname, cmd) {
        if (!cmd) {
            console.error("ERROR - cmd not set");
            return;
        }
        cmd.trim();
        let cmda = cmd.split("-");
        let tlen;

        console.log("RUNNING COMMAND:" + cmd + ":");
        let bRet = true;

        switch (cmda[0]) {
            case 'FWD':
            case 'BACK':
            case 'TURNL':
            case 'TURNR':
                // Expects of the form CMD-XXX-TIME
                // where XXX is SPEED 
                // TIME is the time in ms
                const speed = parseInt(cmda[1], 10);
                tlen = parseInt(cmda[2], 10);
                console.log("STARTING motor command " + cmda[0], speed, time);
                await _helpers._runMotors(robotname, cmda[0], speed, tlen);
                break;
            case 'LEDON':
            case 'LEDONL':
            case 'LEDONR':
            case 'LEDOFF':
            case 'LEDOFFL':
            case 'LEDOFFR':
            case 'BLINK':
            case 'BLINKL':
            case 'BLINKR':
            case 'LEDBLINK':
            case 'LEDBLINKL':
            case 'LEDBLINKR':
                // expects of form CMD-TIME
                if (cmda.length > 1) {
                    tlen = parseInt(cmda[1], 10);
                }
                bRet = _helpers._doLED(robotname, cmda[0], tlen);
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
    testing: function (query) {
        _helpers._testing(query);
    },
    executeCommands: async function (user, commands) {
        if (!_priv.boards) {
            console.log("BOARDS not initialized!");
            return;
        }
        console.log("executeCommands", commands, user);
        /*

        if (!commands) {
            return;
        }

        const cmda = commands.split(",");
        const robotname = 'A';

        for (let cmd of cmda) {
            _helpers._executeCommand(robotname, cmd);
        }

        */
    }
}

// export default arduino

module.exports = arduino