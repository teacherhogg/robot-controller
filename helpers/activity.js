const arduino = require("./arduino");
const dbaccess = require("./dataaccess");

var _priv = {
    arduino: null,
    dbaccess: null,
    ioLocal: null,
    queue: null
}

const _helpers = {
    _getCommandSummary: function (commands) {
        // commands is a potentially comma-separated list of instructions
        if (ninstructions < 1) {
            return commands;
        }

        const a = commands.split(",");
        let lastcmd = '';
        let totalt = 0;
        let validc = 0;
        for (let citem of a) {
            let ac = citem.split("-");
            lastcmd = ac[0];
            if (ac.length > 2) {
                totalt += ac[2];
                validc++;
            }
        }

        return lastcmd + " (" + totalt + ") [" + validc + "]";
    },
    _processCommand: function (challenge, command) {
        // commands is an object with properties:
        //     id, challenge, commands

        if (challenge.challengeName != command.challenge) {
            console.error("challenge incorrect: " + command.challenge + " (" + command.id + ")");
            return false;
        }

        //        console.log("_processCommand called with command", command);
        const uinfo = _priv.dbaccess.getUserData2(command);
        //        console.log("HERE is the uinfo  ", uinfo, command);
        // command.commands is a comma-separated list of commands!
        let ninstructions = 0;
        if (!command.commands) {
            console.error("ERROR - no commands issued!")
            return false;
        } else {
            ninstructions = command.commands.split(",").length;
        }

        uinfo.ncommands++;
        uinfo.ninstructions += ninstructions;

        let cinfo = Object.assign({}, uinfo);
        cinfo.command = _helpers._getCommandSummary(command.commands, ninstructions);

        _priv.ioLocal.emit('commandInfo', cinfo);

        _priv.arduino.executeCommands(uinfo, command.commands);
    },
    _isUserKnown: function (user) {
        const users = _priv.dbaccess.getParticipants();
        /**
         * users is an object with props usernames and value an object with props:
         *  firstname, lastname, passcode, username
         */
        //        console.log("HERE is participants", users);
        if (!users[user.username]) {
            console.error("Unknown User: " + user.username);
            return false;
        }
        return true;
    },
    _isUserOnTeamRobot: function (user) {
        const teams = _priv.dbaccess.getTeams();
        //        console.log("HERE is the teams", teams);

        const robots = _priv.dbaccess.getRobots();
        //        const robots = _priv.config.getConfigData("robots");
        let userrobot = null;
        let userteam = null;
        for (let teamname in teams) {
            const team = teams[teamname];
            for (let member of team.members) {
                if (member.username == user.username) {
                    // Check if the robot is active!

                    for (let robot of robots) {
                        if (robot.id == team.robot) {
                            if (robot.active) {
                                userrobot = team.robot;
                                userteam = teamname;
                            }
                        }
                    }
                }
            }
        }
        if (!userrobot) {
            console.error("USER is NOT a part of an active team: " + user.username);
            //            console.error("robots", robots);
            //            console.error("TEAMS", teams);
            return null;
        }
        let uinfo = _priv.dbaccess.getUserData(user.username);
        if (!uinfo) {
            console.error("ERROR getting user info for " + user.username);
            uinfo = {};
        }
        console.log("USER REGISTERED:" + user.username + " (" + uinfo.firstname + " " + uinfo.lastname + ") robot:" + userrobot + " team:" + userteam);
        return {
            team: userteam,
            robot: userrobot
        }
    },
    _processUser: function (challenge, user) {
        // user is an object with properties:
        //     id, challenge, username, usercode

        // STEP 1: Check if user exists (participants.csv)
        //         Update firstname and lastname properties...
        if (!_helpers._isUserKnown(user)) {
            const msg = "Unkown user trying to register: " + user.username;
            console.error(msg);
            _priv.ioLocal.emit('message', msg);
            return false;
        }

        // STEP 2: Is User on a team (robots.json)
        // STEP 3: and is the robot active/enabled (robots.json)
        const userinfo = _helpers._isUserOnTeamRobot(user);
        if (!userinfo) {
            const msg = "User registering who is not on an active team " + user.username;
            console.error(msg);
            _priv.ioLocal.emit('message', msg);
            return false;
        }

        // STEP 4: Is this team the ONLY team for specified robot
        //         (unless multiteams is true)

        // TODO - NOT IMPLEMENTED!!!
        //        if (!challenge.multiteams) {
        //            const ateams = _priv.dbaccess.getTeams();
        //        }


        // STEP 5: Check if current challenge is correct 
        //         (UNLESS skipChallengeName is set to true)
        if (!challenge.skipchallengename) {
            if (user.challenge != challenge.challengeName) {
                const msg = "CANNOT add user " + user.username +
                    " to challenge " + user.challenge +
                    " because NOT activechallenge: " + challenge.challengeName;
                console.error(msg);
                _priv.ioLocal.emit('message', msg);
                return false;
            }
        }

        // ADD user to challenge!
        user.userrobot = userinfo.robot;
        user.userteam = userinfo.team;

        let uinfo = _priv.dbaccess.getUserData(user.username);
        if (!uinfo) {
            uinfo = {};
        }
        uinfo = Object.assign(uinfo, user);
        _priv.ioLocal.emit('userInfo', uinfo);

        // NOTE - testmode is dangerous. Checks are ignored!
        if (!challenge.testmode) {
            if (!challenge || challenge.phase != "Open") {
                const msg = "REJECTED REGISTRATION for " + user.username + " Challenge not open. Phase is " + challenge.phase;
                console.error(msg);
                _priv.ioLocal.emit('message', msg);
                return;
            }
        }

        _priv.dbaccess.registerUserToChallenge(user);
    }

}

const activity = {
    init: function (arduino, dbaccess, ioLocal) {
        _priv.arduino = arduino;
        _priv.dbaccess = dbaccess;
        _priv.ioLocal = ioLocal;
        _priv.queue = [];
    },
    resetQueue: function () {
        _priv.queue = [];
    },
    processCommand: function (commands) {
        // commands is an array of objects with properties:
        //          id, timestamp, commands, challenge
        //        console.log("PROCESSING COMMAND", commands);

        let challenge = _priv.dbaccess.getChallengeSettings();


        //        console.log("PROCESS COMMAND command is ", commands);
        // commands is an array of objects with props: id, challenge, timestamp, commands
        if (commands && commands.length > 1) {
            console.log("NOTO BIEN: We have multiple commands at once!!! " + commands.length, commands);
        }

        for (let command of commands) {
            if (!challenge.testmode) {
                if (!challenge || challenge.phase != 'Running') {
                    let userinfo = _priv.dbaccess.getUserData2(command);
                    if (!userinfo) {
                        userinfo = {};
                    }
                    const msg = "NOT RUNNING. User command blocked from " + userinfo.firstname + " " + userinfo.lastname + " (" + userinfo.username + ")";
                    console.log(msg);
                    _priv.ioLocal.emit('message', msg);
                    return;
                }
            }

            _helpers._processCommand(challenge, command);
        }
    },
    processUser: function (users) {
        // users is an array of objects with properties:
        //     id, challenge, username, usercode
        //        console.log("PROCESSING USERS", users);

        let challenge = _priv.dbaccess.getChallengeSettings();
        for (let user of users) {
            if (!challenge || challenge.phase !== 'Open') {
                let userinfo = _priv.dbaccess.getUserData(user.username);
                if (!userinfo) {
                    userinfo = {};
                }
                const msg = "NOT OPEN for registration. User blocked: " + userinfo.firstname + " " + userinfo.lastname + " (" + userinfo.username + ")";
                console.log(msg);
                _priv.ioLocal.emit('message', msg);
            } else {
                _helpers._processUser(challenge, user);
            }
        }
    }
}

module.exports = activity