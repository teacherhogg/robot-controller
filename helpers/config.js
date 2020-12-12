const chokidar = require('chokidar')
const fs = require('fs-extra')
const path = require('path')
const objDiff = require('deep-object-diff').diff;

const _priv = {
    configfiles: ["settings.json", "robots.json", "participants.csv"],
    settingsdir: null,
    configs: null,
    challenge: null,
    watcher: null
}

const _helpers = {
    _readJsonSync: function (folder, name, bQuiet) {
        const filename = name + ".json";
        const fullpath = path.join(folder, filename);

        let data = null;
        try {
            data = fs.readJsonSync(fullpath);
        } catch (err) {
            if (!bQuiet) {
                console.error("Error reading file is", err);
            }
            return null;
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
    _checkSettings: function () {
        const name = config.getConfigData("settings", "activechallenge");
        const mode = config.getConfigData("settings", "challengemode");
        console.log("SETTING up Challenge with " + name + " and mode " + mode);
        config.setupChallenge(name, mode);
    }
}

const config = {
    init: function (settingsdir) {
        // Load settings.json
        _priv.settingsdir = settingsdir;
        _priv.configs = {};

        for (let file of _priv.configfiles) {
            const a = file.split(".");
            const fullpath = path.join(settingsdir, file);
            if (!fs.existsSync(fullpath)) {
                console.error("Configuration file " + file + " does not exist!", fullpath);
                return false;
            }

            if (a[1] == "json") {
                _priv.configs[a[0]] = _helpers._readJsonSync(settingsdir, a[0]);
            } else if (a[1] == "csv") {
                _priv.configs[a[0]] = _helpers._readCSVSync(settingsdir, a[0]);
            }
        }

        _helpers._checkSettings();
        console.log("FINISHED INIT and CHALLENGE IS: ", _priv.challenge);

        _helpers._watchDir(settingsdir);

        return true;
    },
    getRobotSettings () {
        let robots = this.getConfigData("robots");

        let rets = [];
        for (let robotname in robots) {
            const robot = robots[robotname];
            if (robot.active) {
                let nr = {
                    id: robotname
                };
                if (robot.port) { nr.port = robot.port; }
                rets.push(nr);
            }
        }

        return rets;
    },
    getLedSettings (robotname) {
        let robots = this.getConfigData("robots");

        if (!robots[robotname] || !robots[robotname].leds) {
            console.error("getMotorSettings failed. No such robot in robots.json " + robotname);
            return null;
        }

        return robots[robotname].leds;
    },
    getMotorSettings (robotname) {
        let robots = this.getConfigData("robots");

        if (!robots[robotname] || !robots[robotname].motors) {
            console.error("getMotorSettings failed. No such robot in robots.json " + robotname);
            return null;
        }

        return robots[robotname].motors;
    },
    getConfigData (name, key) {
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
    },
    addUserToChallenge (user) {
        if (!_priv.challenge || !_priv.challenge.mode == "open") {
            console.error("FATAL ERROR - something wrong in setup for adding user to challenge ", _priv.challenge);
            return;
        }

        _priv.challenge.users[user.id] = user;
        if (!_priv.challenge.robots[user.userrobot]) {
            _priv.challenge.robots[user.userrobot] = [];
        }
        if (!_priv.challenge.robots[user.userrobot].includes(user.userteam)) {
            _priv.challenge.robots[user.userrobot].push(user.userteam);
        }

        console.log("NEW USER added to challenge", _priv.challenge);
    },
    getChallenge () {
        return _priv.challenge;
    },
    changeMode () {
        if (!_priv.challenge) {
            console.error("Cannot change mode. Challenge not setup!");
            return;
        }

        const modes = ["open", "closed", "running", "stopped"];
        let idx = modes.indexOf(_priv.challenge.mode);
        if (idx == -1) {
            console.error("SOMETHIGN STRANGE - mode " + _priv.challenge.mode + " not recognized");
            return;
        }

        idx++;
        if (idx >= modes.length) {
            idx = 0;
        }
        let mode = modes[idx];
        console.log("SETTING MODE TO " + mode);
        this.setupChallenge(_priv.challenge.name, mode);
    },
    setupChallenge (name, mode) {
        console.log("setupChallenge called with " + mode + " -> " + name);
        if (!_priv.challenge) {
            _priv.challenge = {
                mode: mode,
                name: name,
                users: {},
                robots: {}
            };
        } else if (_priv.challenge.name == name && _priv.challenge.mode == mode) {
            // NO Change. Ignore;
            return;
        }

        _priv.challenge.name = name;

        switch (mode) {
            case "open":
                // Newly open! Wipe out any previously registered users.
                _priv.challenge = {
                    mode: "open",
                    name: name,
                    users: {},
                    robots: {}
                };
                console.log("CHALLENGE IS OPEN! " + _priv.challenge.name);
                break;
            case "closed":
                // Newly open! Wipe out any previously registered users.
                _priv.challenge.mode = "closed";
                console.log("CHALLENGE IS CLOSED to new users! " + _priv.challenge.name);
                break;
            case "running":
                // Challenge running - commands allowed!
                _priv.challenge.mode = "running";
                console.log("CHALLENGE IS RUNNING! " + _priv.challenge.name);
                break;

        }
    }
}

module.exports = config
