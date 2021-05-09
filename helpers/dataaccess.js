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
    getRobots: function () {

        if (!_priv.robots) {
            // memoize
            _priv.robots = _priv.config.getRobotSettings(true);
        }

        return _priv.robots;
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
        console.log("getTeams for group " + group);

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
        //        console.log("tdata", tdata);
        for (let team in tdata.data) {
            teams[team] = {
                members: [],
                robot: tdata.data[team].robot
            }
            //            console.log("HERE da team ", team);
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

        console.log("HERE is the resulting teams", teams);
        return teams;
    },
    getParticipants: function (group) {
        if (!group) {
            // Use active group from settings.json
            group = _priv.config.getConfigData("settings", "group");
        }
        console.log("getTeams for group " + group);

        let participants = _priv.config.getGroupData(group, "participants");

        //        console.log("DA participants are", participants);
        return participants.data;
    },
    dbTeamAction: function (action, team, member) {
        return _priv.config.modifyGroupData(_priv.group, "teams", action, team, member);
    },
    dbParticipantAction: function (action, params) {
        return _priv.config.modifyGroupData(_priv.group, "participants", action, null, params);
    }
}

module.exports = dbaccess