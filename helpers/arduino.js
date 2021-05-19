//const SerialPort = require("chrome-apps-serialport").SerialPort;
//const SerialPort = require('serialport').SerialPort
//const Firmata = require("firmata-io")(SerialPort);
const {
    response
} = require('express');
const five = require('johnny-five');

var _priv = {
    boards: null,
    config: null,
    dbaccess: null,
    leds: null,
    blocks: {},
    lastuser: {},
    motors: null
}

const _helpers = {
    _initRobots: function (cb) {
        let rsettings = _priv.dbaccess.getRobots(true);
        let names = [];
        for (let r of rsettings) {
            names.push(r.name);
        }
        console.log("Calling init of boards: " + names.join(","));
        try {
            _priv.boards = new five.Boards(rsettings);

            _priv.boards
                .on("ready", function (info) {

                    console.log("arduino boards are now ready");
                    _priv.lastuser = {};
                    cb("COMPLETED ROBOT INIT");
                })
                .on("error", function (err) {
                    console.error("ERROR from connecting to board", err);
                    cb("ERROR - cannot connect");
                });
        } catch (err) {
            console.error("ERROR initializing robots!!!");
            console.error(err);
            cb("ERROR initializing");
        }
    },
    _setupLeds: function (robotname) {
        if (!_priv.leds) {
            _priv.leds = {};
        }
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
        if (!_priv.motors) {
            _priv.motors = {};
        }
        if (!_priv.motors[robotname]) {
            const minfo = _priv.config.getMotorSettings(robotname);

            //            console.log("HERE are the motor settings for robot " + robotname, minfo);
            const board = _priv.boards.byId(robotname);
            let lsettings = minfo.left;
            lsettings.board = board;
            let rsettings = minfo.right;
            rsettings.board = board;

            let motorL = new five.Motor(lsettings)
            let motorR = new five.Motor(rsettings)

            if (!motorL || !motorR) {
                console.error("ERROR getting motor setup!!! " + robotname);
                return;
            }
            /*
                        _priv.boards[robotname].repl.inject({
                            motorL, motorR
                        });
            */
            _priv.motors[robotname] = {
                left: motorL,
                right: motorR
            }
        }
    },
    _runMotors: function (robotname, cmd, inspeed, time) {
        //        console.log("Running Motors on " + robotname + " " + cmd + " for " + time);
        _helpers._setupMotors(robotname);
        const motors = _priv.motors[robotname];

        return new Promise((resolve, reject) => {
            if (!motors || !motors.left || !motors.right) {
                console.error("ERROR running motors!");
                reject(new Error('Missing Robot Motors'));
            } else {
                const motorL = motors.left;
                const motorR = motors.right;
                let corr = 0;
                let speed = inspeed;
                let speedl, speedr, ndiff;
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
                    case 'TURNFWDL':
                        corr = 100;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
                        speedr = speed + corr;
                        ndiff = speedr - 255;
                        if (ndiff > 0) {
                            corr += ndiff;
                        }
                        speedl = speed - corr;
                        speedl = Math.min(255, speedl);
                        speedr = Math.min(255, speedr);
                        //                      console.log("motorR " + speedr + " motorL " + speedl)
                        if (speedl < 0) {
                            motorL.reverse(Math.abs(speedl));
                        } else {
                            motorL.forward(speedl);
                        }
                        if (speedr < 0) {
                            motorR.reverse(Math.abs(speedr));
                        } else {
                            motorR.forward(speedr);
                        }
                        break;
                    case 'TURNFWDR':
                        corr = 100;
                        speedl = speed + corr;
                        ndiff = speedl - 255;
                        if (ndiff > 0) {
                            corr += ndiff;
                        }
                        speedr = speed - corr;
                        speedl = Math.min(255, speedl);
                        speedr = Math.min(255, speedr);
                        //                        console.log("motorR " + speedr + " motorL " + speedl)
                        if (speedl < 0) {
                            motorL.reverse(Math.abs(speedl));
                        } else {
                            motorL.forward(speedl);
                        }
                        if (speedr < 0) {
                            motorR.reverse(Math.abs(speedr));
                        } else {
                            motorR.forward(speedr);
                        }
                        break;
                    default:
                        console.log("NO RECOGNIZED COMMAND! " + cmd);
                        //                        reject(new Error("CMDERROR " + cmd));
                        return;
                }

                //              console.log("RUNNING CMD " + cmd + " at speed " + speed + " for time " + time);
                const board = _priv.boards.byId(robotname);
                if (!board) {
                    reject(new Error('board.byId ' + robotname + ' returning NULL!'));
                } else {
                    board.wait(time, () => {
                        motorL.stop();
                        motorR.stop();
                        resolve('DONE');
                    });
                }
            }
        });
    },
    _testing: async function (query, robotname) {
        let speed = 255;
        let time = 4000;
        let bTurns = false;

        if (query && query.speed) {
            speed = query.speed;
        }
        if (query && query.time) {
            time = query.time;
        }
        if (query && query.turn) {
            bTurns = true;
        }

        if (bTurns) {
            await _helpers._runMotors(robotname, 'TURNR', speed, time);
            await _helpers._runMotors(robotname, 'TURNL', speed, time);
        } else {
            console.log("Running test sequence!");
            //            await _helpers._doLED(robotname, 'BLINKL', 500);
            //            await _helpers._runMotors(robotname, 'TURNFWDL', 250, 4000);
            //            await _helpers._runMotors('Black', 'FWD', 250, 2000);
            await _helpers._runMotors('Pink', 'TURNFWDL', speed, 4000);
            await _helpers._runMotors('Pink', 'BACK', speed, 4000);
            await _helpers._runMotors('Pink', 'TURNFWDR', speed, 4000);
            await _helpers._runMotors('Pink', 'BACK', speed, 4000);
            //            await _helpers._runMotors('White', 'FWD', 250, 2000);
            //            await _helpers._runMotors(robotname, 'TURNR', 150, 4000);
            /*            await _helpers._doLED(robotname, 'LEDOFFL');
                        await _helpers._doLED(robotname, 'BLINKR', 500);
                        await _helpers._runMotors(robotname, 'BACK', speed, time);
                        await _helpers._doLED(robotname, 'LEDOFFR');
                        await _helpers._doLED(robotname, 'LEDOFFL');
                        await _helpers._runMotors(robotname, 'TURNR', 200, 3000);
                        await _helpers._runMotors(robotname, 'TURNL', 200, 3000);
            */
        }
    },
    _doLED: async function (robotname, cmd, tlen) {
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
                leds.left.stop();
                leds.right.stop();
                leds.left.blink(tlen);
                leds.right.blink(tlen);
                break;
            case 'LEDOFF':
                leds.left.stop();
                leds.right.stop();
                leds.left.off();
                leds.right.off();
                break;
            case 'LEDON':
                leds.left.stop();
                leds.right.stop();
                leds.left.on();
                leds.right.on();
                break;
            case 'LEDBLINKL':
            case 'BLINKL':
                leds.left.stop();
                leds.left.blink(tlen);
                break;
            case 'LEDOFFL':
                leds.left.stop();
                leds.left.off();
                break;
            case 'LEDONL':
                leds.left.stop();
                leds.left.on();
                break;
            case 'LEDBLINKR':
            case 'BLINKR':
                leds.right.stop();
                leds.right.blink(tlen);
                break;
            case 'LEDOFFR':
                leds.right.stop();
                leds.right.off();
                break;
            case 'LEDONR':
                leds.right.stop();
                leds.right.on();
                break;
            default:
                console.error("Unreocgnized command!", cmdtype);
                bRet = false;
                break;
        }
        return bRet;
    },
    _executeCommand: async function (robotname, cmd, cb) {
        if (!cmd) {
            console.error("ERROR - cmd not set");
            if (cb) {
                cb("ERROR");
            }
            return;
        }
        cmd.trim();
        let cmda = cmd.split("-");
        let tlen;

        //        console.log("RUNNING COMMAND:" + cmd + ":");
        let bRet = true;

        switch (cmda[0]) {
            case 'FWD':
            case 'BACK':
            case 'TURNL':
            case 'TURNR':
            case 'TURNFWDL':
            case 'TURNFWDR':
                // Expects of the form CMD-XXX-TIME
                // where XXX is SPEED 
                // TIME is the time in ms
                const speed = parseInt(cmda[1], 10);
                tlen = parseInt(cmda[2], 10);
                //                console.log("STARTING motor command " + cmda[0], speed, tlen);
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

        if (cb) {
            cb(null, robotname);
        }
        return bRet;
    }
}

const arduino = {
    initRobots: function (config, dbaccess, cb) {
        _priv.config = config;
        _priv.dbaccess = dbaccess;
        _helpers._initRobots(cb);
    },
    testing: function (query, robotname) {
        _helpers._testing(query, robotname);
    },
    executeCommands: async function (user, commands) {
        // commands is a comma-separated list of commands.
        if (!_priv.boards) {
            console.log("BOARDS not initialized!");
            return;
        }
        //        console.log("executeCommands", commands, user);

        if (!commands) {
            return;
        }

        const mode = _priv.config.getConfigData("settings", "mode");

        if (mode == "team") {
            if (_priv.lastuser[user.userrobot] == user.username) {
                console.log("BLOCKED " + user.firstname + " on " + user.userrobot);
                return;
            } else {
                _priv.lastuser[user.userrobot] = user.username;
            }
        }

        const cmda = commands.split(",");
        let uinfo = _priv.dbaccess.getUserData(user.username);

        let msg = uinfo.firstname + " " + uinfo.lastname + " (" + user.userrobot + ":" + user.userteam + ") " + commands;
        console.log(msg);


        for (let cmd of cmda) {
            if (!mode || mode == "sync" || mode == "team") {
                await _helpers._executeCommand(user.userrobot, cmd);
            } else {
                if (_priv.blocks[user.userrobot]) {
                    console.log("BLOCKED - command currently running on " + user.userrobot);
                } else {
                    // Only ONE command set per robot at a time.
                    _priv.blocks[user.userrobot] = true;
                    _helpers._executeCommand(user.userrobot, cmd, function (err, rname) {
                        _priv.blocks[user.userrobot] = false;
                        if (err) {
                            console.error("ERROR returned from _executeCommand");
                        } else {
                            console.log("COMPLETE for " + user.userrobot);
                        }
                    });
                }
            }
        }

    }
}

// export default arduino

module.exports = arduino