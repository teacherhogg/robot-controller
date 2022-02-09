//const SerialPort = require("chrome-apps-serialport").SerialPort;
//const SerialPort = require('serialport').SerialPort
//const Firmata = require("firmata-io")(SerialPort);

const five = require('johnny-five');
const {
    Motor_Move_Absolute
} = require('johnny-five/lib/evshield');

var _priv = {
    boards: null,
    boardstatus: {},
    config: null,
    dbaccess: null,
    leds: null,
    blocks: {},
    lastuser: {},
    motors: null
}

const _helpers = {
    _findRobotFromError: function (rsettings, err) {
        let rfound = null;
        for (let r of rsettings) {
            if (err.includes(r.port)) {
                rfound = r;
            }
        }
        return rfound;
    },
    _initRobotsDEPRECATED: function (cb) {
        let rsettings = _priv.dbaccess.getRobots(true);
        let names = [];
        for (let r of rsettings) {
            names.push({
                name: r.name,
                status: false
            });
            // NOTE: Did this to prevent board closing immediately!
            r.repl = false;
        }
        let cbcalled = false;
        console.log("Calling init of boards: " + names.join(","));
        try {
            _priv.boards = new five.Boards(rsettings);

            _priv.boards
                .on("ready", function (info) {

                    console.log("arduino boards are now ready");
                    _priv.lastuser = {};
                    for (let r of rsettings) {
                        r.status = true;
                    }
                    _priv.dbaccess.updateRobotStatus(rsettings);
                    console.log("BOARDS done and ready...", rsettings);

                    this.each(function (board) {
                        console.log("GOTS a board: " + board.id);
                        board.on("message", function (event) {
                            console.log("Got a message type " + event.class, event.message);
                        });
                    });
                    cb(true, "COMPLETED ROBOT INIT");
                })
                .on("error", function (err) {
                    console.error("ERROR from connecting to board: " + cbcalled, err);
                    if (!cbcalled) {
                        cbcalled = true;

                        let emsg = "ERROR connecting to robot.";
                        if (err && err.message) {
                            let rfound = _helpers._findRobotFromError(rsettings, err.message);
                            if (rfound) {
                                emsg = "ERROR connecting to " + rfound.name + " on port " + rfound.port + " (" + err.message + ")";
                            }
                        }
                        cb(false, emsg);
                    }
                });
        } catch (err) {
            console.error("ERROR initializing robots!!!");
            console.error(err);
            if (!cbcalled) {
                cbcalled = true;
                cb(false, "ERROR initializing");
            }
        }
    },
    /**
     * 
     * @param {*} cb Callback function
     * @param {*} rsetting Has properties name and status
     */
    _initOneRobot: function (r) {
        let rsetting = {
            name: r.name,
            id: r.id,
            port: r.port,
            repl: false,
            debug: true,
            timeout: 10000
        }
        // NOTE: Set repl to false to prevent board closing immediately!
        let board = null;
        return new Promise((resolve, reject) => {
            try {
                board = new five.Board(rsetting);

                board
                    .on("ready", function (info) {

                        console.log(rsetting.name + " board now ready");
                        
                        r.status = true;
                        _priv.dbaccess.updateOneRobotStatus(r.id, true);

                        resolve({board: board, id: r.id, success: true});
                    })
                    .on("exit", function(val) {
                        console.log("EXIT called for " + rsetting.name, val);
                    })
                    .on("error", function (err) {
                        let emsg = "ERROR connecting to robot.";
                        if (err && err.message) {
                            emsg = "ERROR connecting to " + rsetting.name + " on port " + rsetting.port + " (" + err.message + ")";
                        }
                        console.error(emsg, err);
                        reject(new Error(emsg));
                    });
            } catch (err) {
                const emsg = "ERROR initializing robot " + robotname;
                console.error(emsg, err);
                reject(new Error(emsg));
            }
        }).then(null, (bob) => {
            console.error("NO CLUE WAZZUP!", bob);
            return null;
        });
    },
    _initRobots: async function (activerobots) {
        _priv.lastuser = {};
        let rsettings = _priv.dbaccess.getRobots();
//        console.log("activerobots", activerobots);
//        console.log("rsettings", rsettings);

        if (!_priv.boards) {
            _priv.boards = {};
        }
        // Delete any robots not currently selected
        for (let r of rsettings) {
            if (r.active) {
                if (!_priv.boardstatus[r.name]) {
                    console.log("INIT board: " + r.name);
                    let robj = await _helpers._initOneRobot(r);
                    if (robj && typeof robj === 'object' && robj.success) {
                        _priv.boards[r.id] = robj.board;
                        console.log("BOARD " + r.name + " INITED!")
                        _priv.boardstatus[r.name] = true;
                    } else {
                        console.error("BOARD " + r.name + " FAILED to init!");
                        _priv.boardstatus[r.name] = false;
                    }
                }
            } else {
                // Robot NOT active
                if (_priv.boards[r.name]) {
                    delete _priv.boards[r.name];
                }
            }
        }

        console.log("_initRobots returns ", _priv.boardstatus);
        return _priv.boardstatus;
    },
    _setupLeds: function (robotid) {
        if (!_priv.leds) {
            _priv.leds = {};
        }
        if (!_priv.leds[robotid]) {
            const linfo = _priv.config.getLedSettings(robotid);

            let lightL = new five.Led({
                board: _priv.boards[robotid],
                pin: linfo.left
            });
            let lightR = new five.Led({
                board: _priv.boards[robotid],
                pin: linfo.right
            });

            if (!lightL || !lightR) {
                console.error("ERROR getting LED setup!!! " + robotid);
                return;
            }

            _priv.leds[robotid] = {
                left: lightL,
                right: lightR
            }
        }
    },
    _setupMotors: function (robotid) {
        if (!_priv.motors) {
            _priv.motors = {};
        }
        if (!_priv.motors[robotid]) {
            console.log("SETTING UP MOTORS for robotid " + robotid);
            const minfo = _priv.config.getMotorSettings(robotid);

            console.log("HERE are the motor settings for robot " + robotid, minfo);
            const board = _priv.boards[robotid];
            let lsettings = minfo.left;
            lsettings.board = board;
            let rsettings = minfo.right;
            rsettings.board = board;

            let motorL = new five.Motor(lsettings)
            let motorR = new five.Motor(rsettings)

            if (!motorL || !motorR) {
                console.error("ERROR getting motor setup!!! " + robotid);
                return;
            }
            _priv.motors[robotid] = {
                left: motorL,
                right: motorR
            }
        }
    },
    _runMotors: function (robotid, cmd, inspeed, time) {
        if (!robotid) {
            console.error("ERROR running cmd " + cmd + " as robotid is undefined!");
        }
//        console.log("Running Motors on " + robotid + " " + cmd + " for " + time);
        _helpers._setupMotors(robotid);
        const motors = _priv.motors[robotid];

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
//                        console.log("MOVING forward with speed " + speed);
                        motorL.forward(speed + corr);
                        motorR.forward(speed - corr);
                        break;
                    case 'BACK':
                        corr = 0;
                        speed = Math.max(Math.min(inspeed, 255 - corr), corr);
//                        console.log("MOVING backward with speed " + speed);
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
                const board = _priv.boards[robotid];
                if (!board) {
                    reject(new Error('board.byId ' + robotid + ' returning NULL!'));
                } else {
                    board.wait(time, () => {
     //                   console.log("TIMES UP!")
                        //                        motorL.reverse(255);
                        //                        motorR.reverse(255);
                        motorL.stop();
                        motorR.stop();
    //                    console.log("STOPPED!");
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
    _executeCommand: async function (robotid, cmd, cb) {
        if (!cmd) {
            console.error("ERROR - cmd not set");
            if (cb) {
                cb("ERROR");
            }
            return;
        }
        cmd.trim();
        let cmda = cmd.split("-");
        if (cmda.length != 3) {
            console.error("ERROR - cmd malformed " + cmd);
            if (cb) {
                cb("ERROR");
            }
            return;
        }
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
//                console.log("RUN " + cmda[0] + " for " + tlen);
                await _helpers._runMotors(robotid, cmda[0], speed, tlen);
//                console.log("DONE runMotors!")
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
                bRet = _helpers._doLED(robotid, cmda[0], tlen);
                break
            default:
                console.log("Unsupported cmd " + cmda[0]);
                bRet = false;
                break;
        }

        if (cb) {
            cb(null, robotid);
        }
        return bRet;
    }
}

const arduino = {
    initRobots: async function (config, dbaccess, activerobots, cb) {
        _priv.config = config;
        _priv.dbaccess = dbaccess;
        const retval = await _helpers._initRobots(activerobots);
//        console.log("initRobots returning ", retval);
        cb(retval);
    },
    testing: function (query, robotname) {
        _helpers._testing(query, robotname);
    },
    driveRobotLocal: async function (robotid, commands, dir) {
//        console.log('driveRobotLocal ' + robotid + ' -> ' + dir);
        if (!_priv.boards || !_priv.boards[robotid]) {
            let error = 'Robot ' + robotid + ' not initialized!';
            console.error(error);
            return error;
        }

        if (dir) {
            // Just do dir if present.
            let cmd;
            switch (dir) {
                case 'forward':
                    cmd = 'FWD-255-1000';
                    break;
                case 'back':
                    cmd = 'BACK-255-1000';
                    break;
                case 'left':
                    cmd = 'TURNL-255-1000';
                    break;
                case 'right':
                    cmd = 'TURNR-255-1000';
                    break;
                default:
                    cmd = 'FWD-255-1000';
            }
  //          console.log("driveRobotLocal " + robotid + " with cmd " + cmd);
            await _helpers._executeCommand(robotid, cmd);
            return '';
        }

        return 'Did Nothing!';
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

        const challenge = _priv.dbaccess.getChallengeSettings();
//        console.log("execute commands on challenge", challenge);

        if (challenge.challengeMode == "team") {
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
            // ignore blank entries.
            if (cmd) {
                if (challenge.challengeMode == "sync" || challenge.challengeMode == "team") {
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
}

// export default arduino

module.exports = arduino