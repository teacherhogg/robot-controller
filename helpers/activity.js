const arduino = require("./arduino");

var _priv = {
    config: null,
    arduino: null,
    dbaccess: null,
    queue: null
}

const _helpers = {
    _processCommand: function (challenge, command) {
        // commands is an object with properties:
        //     id, challenge, commands
        if (!challenge || !challenge.users ||
            !challenge.users[command.id]) {
            console.error(command.id + " User not registered for " + challenge.name + " -> " + command.commands);
            return false;
        }

        if (challenge.name != command.challenge) {
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
    _isUserKnown: function (user, beslack) {
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

        const beslack = _priv.config.getConfigData("settings", "beslack");

        // STEP 1: Check if user exists (participants.csv)
        //         Update firstname and lastname properties...
        if (!_helpers._isUserKnown(user, beslack)) {
            return false;
        }

        // STEP 2: Is User on a team (robots.json)
        // STEP 3: and is the robot active/enabled (robots.json)
        const userinfo = _helpers._isUserOnTeamRobot(user);
        if (!userinfo) {
            return false;
        }

        // STEP 4: Is this team the ONLY team for specified robot
        //         (unless multiteams is true)
        const multiteams = _priv.config.getConfigData("settings", "multiteams");
        if (!multiteams) {
            const currteams = challenge.robots[userinfo.userrobot];
            if (currteams && currteams.length > 0 && !currteams.includes(userinfo.userteam)) {
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
        user.userrobot = userinfo.robot;
        user.userteam = userinfo.team;
        _priv.config.addUserToChallenge(user);
    }

}

const activity = {
    init: function (config, arduino, dbaccess) {
        _priv.config = config;
        _priv.arduino = arduino;
        _priv.dbaccess = dbaccess;
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
            console.log("NEW USER BLOCKED: " + users[0].username);
            return;
        }

        for (let user of users) {
            _helpers._processUser(challenge, user);
        }
    }
}

module.exports = activity