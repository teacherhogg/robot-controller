const _priv = {
  config: null,
  robots: null,
  teams: null,
  challenge: null
}

const _helpers = {
  _getTeamsFromFile: function (group) {
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
        robot: tdata.data[team].robot,
        teamid: team
      }
      //            console.log("HERE da team " + team, tdata);
      if (tdata.data[team].members) {
        for (let member of tdata.data[team].members) {
          if (!participants.data[member]) {
            console.error("ERROR - no such participant " + member + " in team " + team);
          } else {
            let mobj = participants.data[member];
            mobj.username = member;
            mobj.registered = false;
            mobj.absent = false;
            mobj.ncommands = 0;
            mobj.nblocked = 0;
            mobj.ninstructions = 0;
            teams[team].members.push(mobj);
          }
        }
      }
    }

    //        console.log("HERE is the resulting teams", teams);
    return teams;
  }
}

const dbaccess = {
  init: function (config) {
    _priv.config = config;
  },
  getChallengeSettings: function () {
    if (!_priv.challenge) {
      _priv.challenge = _priv.config.getConfigData("settings");
      _priv.challenge.phase = "Stopped";
    }

    return _priv.challenge;
  },
  changePhase: function (phase) {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }
    _priv.challenge.phase = phase;
  },
  getUserData: function (username) {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }

    return _priv.config.getUserData(_priv.challenge.group, username);
  },
  /**
   * 
   * @param {Object} command Is an object with property id that is of form USERNAME-USERCODE 
   * @returns {Object} userinfo 
   */
  getUserData2: function (command) {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }

    if (!command || !command.id) {
      return {};
    }
    const a = command.id.split("-");
    return _priv.config.getUserData(_priv.challenge.group, a[0]);
  },
  updateRobotStatus: function (rarray) {
    for (let arobot of rarray) {
      for (let robot of _priv.robots) {
        if (arobot.name == robot.name) {
          robot.status = arobot.status;
        }
      }
    }

    //        console.log("UPDATED ROBOT STATUS ", _priv.robots);
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
  /**
   * 
   * @param {Object} params Props with _group, _challengename, _challengemode, and names of activated robots.
   * @returns Array List of activated robots
   */
  updateChallengeSettings: function (params) {
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
        if (arobot.charAt(0) !== "_") {
          if (arobot == robot.id) {
            active.push(robot.id);
            robot.active = true;
          }
        }
      }
    }

    this.getChallengeSettings();
    if (params._challengename) {
      _priv.challenge.challengeName = params._challengename;
    }
    if (params._challengename) {
      _priv.challenge.challengeMode = params._challengemode;
    }
    if (params._group) {
      _priv.challenge.group = params._group;
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
   * @param {Object} challenge has props name and mode
   * @param {Object} user has props userteam userrobot etc.
   */
  registerUserToChallenge: function (user) {
    let teams = this.getTeams();

    const team = teams[user.userteam];
    if (!team) {
      console.error("SOMETHING WRONG - registering user who is not on a team!", user);
      return false;
    }
    for (let member of team.members) {
      if (member.username == user.username) {
        member.registered = true;
      }
    }
  },
  /**
   * @param {String} group Name of group 
   * @returns {Object} Props are team names and values are array of member objects with first, last, username, passcode.
   *
   */
  getTeams: function () {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }

    if (!_priv.teams) {
      _priv.teams = {};
    }
    if (!_priv.teams[_priv.challenge.group]) {
      _priv.teams[_priv.challenge.group] = {};
    }
    if (!_priv.teams[_priv.challenge.group][_priv.challenge.challengeName]) {
      _priv.teams[_priv.challenge.group][_priv.challenge.challengeName] = _helpers._getTeamsFromFile(_priv.challenge.group);
    }
    return _priv.teams[_priv.challenge.group][_priv.challenge.challengeName];
  },
  removeParticipantFromTeam: function (teamid, username) {
    return this.dbTeamAction("delete", teamid, username);
  },
  addParticipantToTeam: function (teamid, username) {
    console.log("addParticipantToTeam " + teamid + " -> " + username)
    return this.dbTeamAction("add", teamid, username);
  },
  addNewParticipant: function (pobj) {
    console.log("addNewParticipant ", pobj);
    return this.dbParticipantAction("add", pobj);
  },
  addRobotToTeam: function (teamid, robotid) {
    console.log("Adding robot to team " + teamid + " robotid:" + robotid);
    return this.dbTeamAction("robotadd", teamid, robotid);
  },
  getParticipants: function () {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }
    let participants = _priv.config.getGroupData(_priv.challenge.group, "participants");

    return participants.data;
  },
  dbTeamAction: function (action, team, param) {
    console.log("dbTeamAction got " + action + " for " + team, param);
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }

    let teams = this.getTeams(_priv.challenge.challengeName);

    if (action == 'addteam') {
      // Add new team
      if (!teams[team]) {
        teams[team] = {
          members: [],
          teamid: team,
          robot: ""
        }
      }
      // Also add to teams.json
      return _priv.config.modifyGroupData(_priv.challenge.group, "teams", action, team, param);
    } else if (action == "deleteteam") {
      // Delete the team
      const ret = _priv.config.modifyGroupData(_priv.challenge.group, "teams", action, team, param);
      delete _priv.teams[_priv.challenge.group][_priv.challenge.challengeName][team];
      return ret;
    } else if (action == "delete") {
      // Delete member from team
      teams[team].members = teams[team].members.filter(function (el) {
        if (el.username == param) {
          return false;
        } else {
          return true;
        }
      });
      // Also update teams.json
      return _priv.config.modifyGroupData(_priv.challenge.group, "teams", action, team, param);
    } else if (action == "add") {
      // Add member to team
      const exists = teams[team].members.some((el) => el.username == param);
      if (!exists) {
        let userobj = this.getUserData(param);
        userobj.registered = false;
        userobj.ncommands = 0;
        userobj.nblocked = 0;
        userobj.ninstructions = 0;

        teams[team].members.push(userobj);
        // Also add to teams.json
        return _priv.config.modifyGroupData(_priv.challenge.group, "teams", action, team, param);
      }
    } else if (action == "robotadd") {
      // Associate Robot ot the team
      if (!teams[team]) {
        // Doesn't make sense. Should exist
        console.error("ERROR - team does not exist! " + team, teams);
        return false;
      }
      // param will be the robot name
      teams[team].robot = param;

      // Also add to teams.json
      return _priv.config.modifyGroupData(_priv.challenge.group, "teams", action, team, param);
    }
  },
  dbParticipantAction: function (action, params) {
    if (!_priv.challenge) {
      this.getChallengeSettings();
    }
    return _priv.config.modifyGroupData(_priv.challenge.group, "participants", action, null, params);
  }
}

module.exports = dbaccess