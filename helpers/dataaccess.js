const _priv = {
    config: null,
    group: null,
    robots: null
}

const _helpers = {

}

const dbaccess = {
    init: function (config) {
        _priv.config = config;
    },
    getUserData: function (username) {
        if (!_priv.group) {
            // Use active group from settings.json
            _priv.group = _priv.config.getConfigData("settings", "group");
        }

        return _priv.config.getUserData(_priv.group, username);
    },
    getRobots: function (bActiveOnly) {

        if (!_priv.robots) {
            // memoize
            _priv.robots = _priv.config.getRobotSettings(true);
        }

        if (bActiveOnly) {
            let active = [];
            for (let robot of _priv.robots) {
                if (robot.active) {
                    active.push(robot);
                }
            }
            return active;
        } else {
            return _priv.robots;
        }
    },
    updateActiveRobots: function (params) {
        if (!_priv.robots) {
            this.getRobots();
        }

        /** params will be object with props the Robot ID and value
         * "on". If it is empty, that means NO robots are on.
         **/
        let active = [];
        for (let robot of _priv.robots) {
            robot.active = false;
            for (let arobot in params) {
                if (arobot == robot.id) {
                    active.push(robot.id);
                    robot.active = true;
                }
            }
        }

        if (active.length > 0) {
            //            console.log("Active robots: ", active);
            return active;
        } else {
            console.log("NO active robots!");
            console.log("params", params);
            console.log("robots", _priv.robots);
            return null;
        }
    },
    /**
     * 
     * @param {String} group Name of group 
     * @returns {Object} Props are team names and values are array of member objects with first, last, username, passcode.
     *
     */
    getTeams: function (group) {
        if (!group) {
            // Use active group from settings.json
            group = _priv.config.getConfigData("settings", "group");
        }
        _priv.group = group;
        //        console.log("getTeams for group " + group);

        let tdata = _priv.config.getGroupData(group, "teams");
        let participants = _priv.config.getGroupData(group, "participants");
        /** 
         * Note that getGroupData returns object in form:
         *  {
         *      data: {},
         *      name: 'thename'
         *  } 
         */

        let teams = {};
        //        console.log("getGropuData tdata", tdata);
        for (let team in tdata.data) {
            teams[team] = {
                members: [],
                robot: tdata.data[team].robot
            }
            //            console.log("HERE da team " + team, tdata);
            if (tdata.data[team].members) {
                for (let member of tdata.data[team].members) {
                    if (!participants.data[member]) {
                        console.error("ERROR - no such participant " + member + " in team " + team);
                    } else {
                        let mobj = participants.data[member];
                        mobj.username = member;
                        teams[team].members.push(mobj);
                    }
                }
            }
        }

        //        console.log("HERE is the resulting teams", teams);
        return teams;
    },
    getParticipants: function (group) {
        if (!group) {
            // Use active group from settings.json
            group = _priv.config.getConfigData("settings", "group");
        }
        //        console.log("getTeams for group " + group);

        let participants = _priv.config.getGroupData(group, "participants");

        //        console.log("DA participants are", participants);
        return participants.data;
    },
    dbTeamAction: function (action, team, param) {
        if (!_priv.group) {
            // Use active group from settings.json
            _priv.group = _priv.config.getConfigData("settings", "group");
        }
        return _priv.config.modifyGroupData(_priv.group, "teams", action, team, param);
    },
    dbParticipantAction: function (action, params) {
        if (!_priv.group) {
            // Use active group from settings.json
            _priv.group = _priv.config.getConfigData("settings", "group");
        }
        return _priv.config.modifyGroupData(_priv.group, "participants", action, null, params);
    }
}

module.exports = dbaccess