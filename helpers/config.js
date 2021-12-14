const chokidar = require('chokidar')
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')
const objDiff = require('deep-object-diff').diff;

const _priv = {
  configfiles: ["settings.json", "robots.yml", "participants.csv"],
  settingsdir: null,
  configs: null,
  watcher: null,
  groupdata: null
}

const _helpers = {
  _writeJson: function (folder, name, data) {
    const filename = name + ".json";
    const fullpath = path.join(folder, filename);

    fs.writeJson(fullpath, data, err => {
      if (err) {
        console.error("ERROR writing to " + filename);
      }
    });

  },
  _writeYAML: function (folder, name, data) {
    let ydata;
    try {
      ydata = yaml.dump(data);
    } catch (e) {
      if (!bQuiet) {
        console.error("ERROR converting to YAML ", data, e);
      }
      return false;
    }

    const filename = name + ".yml";
    const fullpath = path.join(folder, filename);
    if (!fs.writeFileSync(ydata, fullpath, 'utf8')) {
      if (!bQuiet) {
        console.error("ERROR writing yaml file " + fullpath);
      }
      return false;
    }

    return true;
  },
  _readYAMLSync: function (folder, name, bQuiet) {
    const filename = name + ".yml";
    const fullpath = path.join(folder, filename);

    if (!fs.existsSync(fullpath)) {
      if (!bQuiet) {
        console.error("ERROR cannnot find " + filename + "!", fullpath);
      }
      return null;
    }

    const yfile = fs.readFileSync(fullpath, 'utf8');
    let ydata;
    try {
      ydata = yaml.load(yfile);
      //      console.log("YAML file loaded and parsed " + fullpath, ydata);
    } catch (e) {
      //      console.log("HERE is the yfile\n", yfile);
      if (!bQuiet) {
        console.error("ERROR parsing YAML file " + fullpath, e);
      }
      return null;
    }

    let rdata = {
      data: ydata,
      name: name
    }
    return rdata;
  },
  _readJsonSync: function (folder, name, bQuiet) {
    const filename = name + ".json";
    const fullpath = path.join(folder, filename);

    let data = null;
    try {
      data = fs.readJsonSync(fullpath);
    } catch (err) {
      if (!bQuiet) {
        console.error("Error reading file. Will create!");
      }
      fs.outputJsonSync(fullpath, {});
      data = {};
    }
    let rdata = {
      data: data,
      name: name
    }

    return rdata;
  },
  _readCSVSync: function (folder, name, bQuiet) {
    const filename = name + ".csv";
    const fullpath = path.join(folder, filename);

    let hdata = _helpers._readJsonSync(folder, name);
    if (!hdata || !hdata.data || !hdata.data.header) {
      console.error("CANNOT find " + name + ".json file with header prop");
      return {};
    }
    let header = hdata.data.header;

    let data = null;
    try {
      data = fs.readFileSync(fullpath, 'utf8');
    } catch (err) {
      if (!bQuiet) {
        console.error("Error reading CSV file", err);
        return null;
      }
    }

    let rdata = {
      name: name,
      data: []
    };
    const rows = data.toString().split(/(?:\r\n|\r|\n)/g)
    for (let n = 0; n < rows.length; n++) {
      const rowdata = rows[n].split(',')
      const newrow = {};
      for (let m = 0; m < rowdata.length; m++) {
        newrow[header[m]] = rowdata[m].trim();
      }
      rdata.data.push(newrow)
    }
    return rdata;
  },
  _watchDir: function (dir, cbxmap) {
    _priv.watcher = chokidar.watch(dir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    const log = console.log.bind(console);
    _priv.watcher
      .on('change', fpath => {
        log(`File ${fpath} has been changed`);
        const fobj = path.parse(fpath);
        log(`${fobj.base} changed with extension ${fobj.ext}`);
        if (fobj.ext == '.json') {
          _priv.configs[fobj.name] = _helpers._readCB(_helpers._readJsonSync, _priv.settingsdir, fobj.name);
          if (fobj.name == "settings") {
            _helpers._checkSettings();
          }
        } else if (fobj.ext == '.csv') {
          _priv.configs[fobj.name] = _helpers._readCB(_helpers._readCSVSync, _priv.settingsdir, fobj.name);
        } else {
          console.log("FILE TYPE not recognized for processing " + fobj.ext, fpath);
        }
      })
      .on('unlink', fpath => log(`File ${fpath} has been removed`));
  },
  _readCB: function (readSync, folder, name) {
    console.log("file changed", name);
    console.log("OLD values", _priv.configs[name]);
    let newd = readSync(folder, name);
    const diff = objDiff(_priv.configs[name], newd);
    _priv.configs[name] = newd;
    console.log("NEW values", newd);
    console.log("DIFF json", diff);
    console.log("DIFF jsons", JSON.stringify(diff, "   "));

    return {
      data: newd.data,
      name: newd.name,
      diff: diff
    }
  },
  _checkSettingsDEPRECATED: function () {
    const name = config.getConfigData("settings", "activechallenge");
    const mode = config.getConfigData("settings", "challengemode");
    console.log("SETTING up Challenge with " + name + " and mode " + mode);
    config.setupChallenge(name, mode);
  },
  _saveDataToFile: function (group, name, data) {
    //        console.log("_saveDataToFile called with: " + _priv.settingsdir + ":" + group);
    //        console.log("JSON DATA for " + name, data);
    const dir = path.join(_priv.settingsdir, "challenges", group);
    if (name == 'robots') {
      _helpers._writeYAML(dir, name, data);
    } else {
      _helpers._writeJson(dir, name, data);
    }
  }
}

const config = {
  init: function (settingsdir) {
    // Load settings.json
    console.log("SETTINGS DIR in config" + settingsdir);
    _priv.settingsdir = settingsdir;
    _priv.configs = {};

    for (let file of _priv.configfiles) {
      const a = file.split(".");
      const fullpath = path.join(settingsdir, file);
      if (!fs.existsSync(fullpath)) {
        console.error("Configuration file " + file + " does not exist!", fullpath);
        return false;
      }

      if (a[1] == "yml") {
        _priv.configs[a[0]] = _helpers._readYAMLSync(settingsdir, a[0]);
      } else if (a[1] == "json") {
        _priv.configs[a[0]] = _helpers._readJsonSync(settingsdir, a[0]);
      } else if (a[1] == "csv") {
        _priv.configs[a[0]] = _helpers._readCSVSync(settingsdir, a[0]);
      }
    }

    //        _helpers._checkSettings();
    //        console.log("FINISHED INIT and CHALLENGE IS: ", _priv.challenge);
    //    console.log("CONFIG DATA", _priv.configs);

    // DISABLE WATCHDIR
    //        _helpers._watchDir(settingsdir);

    return true;
  },
  getUserData: function (group, username) {
    const name = 'participants';
    if (!_priv.groupdata || !_priv.groupdata[name]) {
      this.getGroupData(group, name);
      if (!_priv.groupdata[name]) {
        console.error("GROUP data not loaded! " + group);
        return null;
      }
    }

    if (_priv.groupdata && _priv.groupdata[name] &&
      _priv.groupdata[name].data &&
      _priv.groupdata[name].data[username]) {
      return _priv.groupdata[name].data[username];
    } else {
      console.error("NO such userdata found! " + username + " " + group);
      return {};
    }
  },
  modifyGroupData: function (group, name, action, team, member) {
    if (!_priv.groupdata || !_priv.groupdata[name]) {
      this.getGroupData(group, name);
      if (!_priv.groupdata[name]) {
        console.error("GROUP data not loaded! " + group);
        return false;
      }
    }
    if (name == "participants") {
      //            console.log("WE ARE ADDING A PART...", member);
      if (action == "add") {
        let pa = _priv.groupdata[name].data;
        if (!pa) {
          pa = {};
          _priv.groupdata[name].data = pa;
        }
        if (member.username) {
          if (!pa[member.username]) {
            pa[member.username] = {
              username: member.username
            };
          }
          if (member.firstname) {
            pa[member.username].firstname = member.firstname;
          }
          if (member.lastname) {
            pa[member.username].lastname = member.lastname;
          }
          if (member.usercode) {
            pa[member.username].usercode = member.usercode;
          }

          pa[member.username].absent = member.absent ? true : false;

          //                    console.log("ADDED new partipant!!!");

          // Save the changes to participants.
          _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
          return true;
        }
      }
    } else if (name == 'teams') {
      let tobj = _priv.groupdata[name].data[team]
      if (action == "delete") {
        // Removes a member from a team
        if (tobj) {
          _priv.groupdata[name].data[team].members = tobj.members.filter(user => user !== member);
          //                    console.log("HERE is new members in team without " + member, tobj);

          // Save changes.
          _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
          return true;
        }
      } else if (action == "add") {
        //                console.log("ADDING member " + member + " to team " + team);
        // Adds a member to a team
        if (tobj && !tobj.members) {
          tobj.members = [];
        }
        if (tobj && !tobj.members.includes(member)) {
          tobj.members.push(member);

          // Save changes.
          _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
          return true;
        }
      } else if (action == "robotadd") {
        // Assigns robot to a team
        console.log("Adding robot to team! " + team + "->" + member, _priv.groupdata[name]);
        if (tobj) {
          tobj.robot = member;
          _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
          return true;
        }
      } else if (action == "addteam") {
        if (!tobj) {
          _priv.groupdata[name].data[team] = {
            members: [],
            robot: ""
          }

          // Save changes.
          _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
          return true;
        }
      } else if (action == "deleteteam") {

        //        console.log("DELETEING name:" + name + " team:" + team, _priv.groupdata[name]);
        delete _priv.groupdata[name].data[team]
        _helpers._saveDataToFile(group, name, _priv.groupdata[name].data);
        console.log("HERE IS TEAMS AFTER DELETE of " + name + "->" + team, _priv.groupdata[name].data);
        return true;
      }
    } else {
      console.error("ERROR - not implemented for " + name);
    }
    return false;
  },
  getGroupData: function (group, name) {
    if (!_priv.groupdata) {
      _priv.groupdata = {};
    }
    if (!_priv.groupdata[name]) {
      // memoize
      let dir = path.join(_priv.settingsdir, "challenges", group);
      _priv.groupdata[name] = _helpers._readJsonSync(dir, name);
      if (!_priv.groupdata[name]) {
        _priv.groupdata[name] = {
          data: {},
          name: name
        };
      }
      //            console.log("getGroupData for " + name, _priv.groupdata[name]);
    }

    return _priv.groupdata[name];
  },
  getRobotSettings(bAll) {
    let robots = this.getConfigData("robots");
    //        console.log("config data => robots", robots);

    let rets = [];
    for (let robotname in robots) {
      const robot = robots[robotname];
      if (bAll || robot.active) {
        let nr = {
          id: robotname,
          active: robot.active,
          status: false
        };
        if (robot.port) {
          nr.port = robot.port;
        }
        if (robot.metadata) {
          Object.assign(nr, robot.metadata);
        }
        rets.push(nr);
      }
    }

    return rets;
  },
  getLedSettings(robotname) {
    let robots = this.getConfigData("robots");

    if (!robots[robotname] || !robots[robotname].leds) {
      console.error("getMotorSettings failed. No such robot in robots.json " + robotname);
      return null;
    }

    return robots[robotname].leds;
  },
  getMotorSettings(robotname) {
    let robots = this.getConfigData("robots");

    if (!robots[robotname] || !robots[robotname].motors) {
      console.error("getMotorSettings failed. No such robot in robots.json " + robotname);
      return null;
    }

    return robots[robotname].motors;
  },
  /**
   * 
   * @param {String} name First part of filename (exclude .json)
   * @param {String} key Optional key (return ALL if falsey)
   * @returns data
   */
  getConfigData(name, key) {
    if (!_priv.configs[name] || !_priv.configs[name].data) {
      console.error("UNABLE to get config data for " + name, _priv.configs);
      return null;
    }

    const data = _priv.configs[name].data;
    if (!key) {
      return data;
    }

    if (!data.hasOwnProperty(key)) {
      console.error("ERROR getting key " + key + " from " + name, _priv.configs);
      return null;
    }

    return data[key];
  }
}

module.exports = config