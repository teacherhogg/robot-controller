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
        const a = commands.split(",");
        let lastcmd = '';
        let totalt = 0;
        let validc = 0;
        for (let citem of a) {
            let ac = citem.split("-");
            lastcmd = ac[0];
            if (ac.length > 2) {
                let tsec = parseInt(ac[2], 10) * 0.001
                totalt += tsec;
                validc++;
            }
        }

        return lastcmd + " (" + totalt + " s) [" + validc + " i]";
    },
    _processCommand: async function (challenge, command) {
        // commands is an object with properties:
        //     id, challenge, commands

        if (challenge.phase !== 'Running') {
            const uinfo2 = _priv.dbaccess.getUserData2(command);
            let msg = "Challenge " + command.challenge + " not currently Running! Command Rejected.";
            if (uinfo2 && uinfo2.username) {
                msg = uinfo2.username + " command rejected as Challenge not currently running!";
            }
            console.error(msg);
            _priv.ioLocal.emit('message', msg);
            return false;
        }

        if (challenge.challengeName != command.challenge) {
            const msg = "challenge incorrect: " + command.challenge + " (" + command.id + ")";
            console.error(msg);
            _priv.ioLocal.emit('message', msg);
            return false;
        }


//        console.log("_processCommand called with command", command);
        const uinfo = _priv.dbaccess.getUserData2(command);
//        console.log("HERE is the uinfo  ", uinfo, command);
        // Check that this user is registered with a robot in this challenge!
        if (!uinfo.userrobot) {

            const userinfo = _helpers._isUserOnTeamRobot(uinfo, true);
            console.error("HERE da robot stuff", userinfo);

            let msg = "";
            if (!userinfo) {
                msg = "User " + uinfo.username + " not registered with any team.";
            } else if (userinfo && !userinfo.active) {
                msg = "User " + uinfo.username + " registered to robot " + userinfo.robot  + " but robot not active.";
            } else {
                msg = "User " + uinfo.username + "  registered to robot " + userinfo.robot + " but needs to Re-register for current challenge.";
            }
            console.error(msg);
            console.error(uinfo);
            _priv.ioLocal.emit('message', msg);
            return false;
        }

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

        console.log("RUN COMMANDS for " + uinfo.username);
        let bRet= await _priv.arduino.executeCommands(uinfo, command.commands);
        if (!bRet) {
            console.error("FAILED TO RUN COMMAND!!! for " + uinfo.username);
            uinfo.nblocked++;
            cinfo.nblocked++;
            _priv.ioLocal.emit('commandInfo', cinfo);
        }

        const tstats = dbaccess.updateTeamStats(uinfo, 1, ninstructions, bRet ? 0 : 1);
        if (tstats) {
            _priv.ioLocal.emit('teamStats', tstats);
        }
    },
    _isUserKnown: function (user) {
        const users = _priv.dbaccess.getParticipants();
        /**
         * users is an object with props usernames and value an object with props:
         *  firstname, lastname, passcode, username
         */
        //        console.log("HERE is participants", users);
        if (!users[user.username]) {
            return false;
        }
        return true;
    },
    _isUserOnTeamRobot: function (user, allrobots) {
        const teams = _priv.dbaccess.getTeams();
//        console.log("HERE is the teams", teams);

        const robots = _priv.dbaccess.getRobots();
        // const robots = _priv.config.getConfigData("robots");
        let userrobot = null;
        let userteam = null;
        let active = false;
        for (let teamname in teams) {
            const team = teams[teamname];
            for (let member of team.members) {
                if (member.username == user.username) {
                    // Check if the robot is active!

                    for (let robot of robots) {
                        if (robot.id == team.robot) {
                            if (robot.active || allrobots) {
                                userrobot = team.robot;
                                userteam = teamname;
                                active = robot.active;
                            }
                        }
                    }
                }
            }
        }
        if (!userrobot) {
            console.error("USER is NOT a part of an active team: " + user.username, user);
            console.error("robots", robots);
            console.error("TEAMS", JSON.stringify(teams, null, 3));
            return null;
        }
        let uinfo = _priv.dbaccess.getUserData(user.username);
        if (!uinfo) {
            console.error("ERROR getting user info for " + user.username);
            uinfo = {};
        }
        console.log("USER REGISTERED:" + user.username + " (" + uinfo.firstname + " " + uinfo.lastname + ") robot:" + userrobot + " team:" + userteam);
        return {
            active: active,
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
            if (challenge.testmode) {
                // We are in testmode which will automatically register this user!
                if (!dbaccess.dbParticipantAction("add", user)) {
                    const msg = "Failed to automatically add (testmode) user: " + user.username;
                    console.error(msg);
                    _priv.ioLocal.emit('message', msg);
                    return false;
                } else {
                    const msg = "Just auto added " + user.username + ". Refresh Teams tab to add to a team!";                    
                    console.log(msg);
                    _priv.ioLocal.emit('message', msg);
                    return false;
                }
            } else {
                const msg = "Unkown user trying to register: " + user.username;
                console.error(msg);
                _priv.ioLocal.emit('message', msg);
                return false;
            }
        }

        // STEP 2: Is User on a team (teams.json)
        // STEP 3: and is the robot active/enabled (robots.yml)
        const userinfo = _helpers._isUserOnTeamRobot(user);
        if (!userinfo) {
            const msg = user.username + " trying to register but is not on an active team.";
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
        //console.log("PROCESSING COMMAND", commands);

        let challenge = _priv.dbaccess.getChallengeSettings();
//        console.log("processCommand for challenge " + challenge.phase, challenge);

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
                let msg = "NOT OPEN for registration. User blocked: ";
                if (!userinfo || !userinfo.username) {
                  msg += user.firstname + " " + user.lastname + " (" + user.username + ")";
                } else {
                  msg += userinfo.firstname + " " + userinfo.lastname + " (" + userinfo.username + ")";
                }
                console.log(msg);
                _priv.ioLocal.emit('message', msg);
            } else {
                _helpers._processUser(challenge, user);
            }
        }
    }
}

module.exports = activity