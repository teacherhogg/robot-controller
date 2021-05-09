const arduino = require("./arduino");

var _priv = {
    config: null,
    arduino: null,
    queue: null
}

const _helpers = {
    _processCommand: function (challenge, command) {
        // commands is an object with properties:
        //     id, challenge, commands
        if (!challenge || !challenge.users ||
            !challenge.users[command.id] ||
            challenge.name != command.challenge) {
            console.error("challenge incorrect: " + command.challenge + " (" + command.id + ")");
            return false;
        }

        const user = challenge.users[command.id];
        // command.commands is a comma-separated list of commands!
        if (!command.commands) {
            console.error("ERROR - no commands issued!")
            return false;
        }

        _priv.arduino.executeCommands(user, command.commands);
    },
    _processUser: function (challenge, user) {
        // user is an object with properties:
        //     id, challenge, username, usercode

        const beslack = _priv.config.getConfigData("settings", "beslack");

        // STEP 1: Check if user exists (participants.csv)
        //         Update firstname and lastname properties...
        const users = _priv.config.getConfigData("participants");
        let bUserFound = false;
        for (let ruser of users) {
            if (ruser.username == user.username) {
                if (!beslack) {
                    if (ruser.usercode != user.usercode) {
                        console.error("INCORRECT usercode for username " + user.username + " code: " + user.usercode);
                        return false;
                    } else {
                        user = Object.assign(user, ruser);
                        bUserFound = true;
                    }
                } else {
                    // ignore usercode if beslack is true
                    user = Object.assign(user, ruser);
                    bUserFound = true;
                }
            }
        }
        if (!bUserFound) {
            console.error("INVALID PARTICIPANT username:" + user.username + " usercode:" + user.usercode);
            return false;
        }

        // STEP 2: Is User on a team (robots.json)
        // STEP 3: and is the robot active/enabled (robots.json)
        const robots = _priv.config.getConfigData("robots");
        let userrobot = null;
        let userteam = null;
        for (let robotname in robots) {
            const robot = robots[robotname];
            if (robot.active) {
                for (let team in robot.teams) {
                    const members = robot.teams[team];
                    for (let member of members) {
                        if (member == user.username) {
                            userrobot = robotname;
                            userteam = team;
                        }
                    }
                }
            }
        }
        if (!userrobot) {
            console.error("USER is NOT a part of an active robot's team: " + user.username);
            return false;
        }
        console.log("USER REGISTERED:" + user.username + " (" + user.firstname + ") robot:" + userrobot + " team:" + userteam);


        // STEP 4: Is this team the ONLY team for specified robot
        //         (unless multiteams is true)
        const multiteams = _priv.config.getConfigData("settings", "multiteams");
        if (!multiteams) {
            const currteams = challenge.robots[userrobot];
            if (currteams && currteams.length > 0 && !currteams.includes(userteam)) {
                console.error("ERROR - PROBLEM encountered where a user from ANOTHER team already registered on this robot for this challenge! " + userteam, challenge);
                return false;
            }
        }


        // STEP 5: Check if current challenge is correct 
        //         (UNLESS beslack is set to true)
        if (!beslack) {
            if (user.challenge != challenge.name) {
                console.error("CANNOT add user " + user.username +
                    " to challenge " + user.challenge +
                    " because NOT activechallenge: " + challenge.name);
                return false;
            }
        }

        // ADD user to challenge!
        user.userrobot = userrobot;
        user.userteam = userteam;
        _priv.config.addUserToChallenge(user);
    }

}

const activity = {
    init: function (config, arduino) {
        _priv.config = config;
        _priv.arduino = arduino;
        _priv.queue = [];
    },
    resetQueue: function () {
        _priv.queue = [];
    },
    processCommand: function (commands) {
        // commands is an array of objects with properties:
        //          id, timestamp, commands, challenge
        //        console.log("PROCESSING COMMAND", commands);

        let challenge = _priv.config.getChallenge();
        const testmode = _priv.config.getConfigData("settings", "testmode");

        if (!testmode) {
            if (!challenge || challenge.mode != 'running') {
                console.log("CHALLENGE MODE is " + challenge.mode, challenge);
                console.log("CANNOT EXECUTE NEW COMMANDS. Not running? ", commands);
                return;
            }
        }

        //        console.log("PROCESS COMMAND command is ", commands);
        // commands is an array of objects with props: id, challenge, timestamp, commands
        if (commands && commands.length > 1) {
            console.log("NOTO BIEN: We have multiple commands at once!!! " + commands.length, commands);
        }

        for (let command of commands) {
            _helpers._processCommand(challenge, command);
        }
    },
    processUser: function (users) {
        // users is an array of objects with properties:
        //     id, challenge, username, usercode
        //        console.log("PROCESSING USERS", users);

        let challenge = _priv.config.getChallenge();
        if (!challenge || challenge.mode != 'open') {
            console.log("CHALLENGE MODE is " + challenge.mode, challenge);
            console.log("NEW USERS BLOCKED", users);
            return;
        }

        for (let user of users) {
            _helpers._processUser(challenge, user);
        }
    }
}

module.exports = activity