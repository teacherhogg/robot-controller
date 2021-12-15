// Load the dotenv file!
require('dotenv').config()

const config = require('../helpers/config')
const arduino = require('../helpers/arduino')
const activity = require('../helpers/activity')
const dbaccess = require('../helpers/dataaccess')
const robotServer = require('../helpers/connect-server')
const cool = require('cool-ascii-faces')

var express = require('express');
var router = express.Router();


const phases = ['Open', 'Closed', 'Running', 'Stopped'];

let activerobots = [];

var activateRobots = function (req, res) {
    //  console.log("ACTIVATE: HERE is req object", req.body);

    /** req.body will be object with props the Robot ID and value
     * "on". If it is empty, that means NO robots are on.
     * Also will have props:
     *  _group
     *  _challengename
     *  _challengemode
     **/

    if (activerobots = dbaccess.updateChallengeSettings(req.body)) {
        // Activate. actve is an array of robotids 
        console.log("Activating Robots", activerobots);

        // Initialize the boards
        arduino.initRobots(config, dbaccess, function (success, emsg) {
            if (!success) {
                console.error(emsg);
                robots(req, res, {
                    message: emsg
                });
            } else {
                console.log("FINISHED initRobots!!!");
                teams(req, res);
            }

        });
    }
}

var robotAction = function (req, res) {
    // Note that req.body does not inherit from Object
    const params = JSON.parse(JSON.stringify(req.body));

    console.log("ROBOT ACTION", params);

    if (params.hasOwnProperty('robotadd')) {
        if (dbaccess.dbTeamAction("robotadd", params.team, params.robotadd)) {
            teams(req, res);
        } else {
            console.error("DID NOT PART HAPPEN");
        }
    }
}

var participantAction = function (req, res) {
    //  console.log("PARTICIPANT action ", req.body);

    // Note that req.body does not inherit from Object
    const params = JSON.parse(JSON.stringify(req.body));

    if (params.hasOwnProperty('addparticipant')) {
        if (dbaccess.dbParticipantAction("add", params)) {
            teams(req, res);
        } else {
            console.error("DID NOT PART HAPPEN");
        }
    }
}

var teamAction = function (req, res) {

    const _processAction = function (action, team, member) {
        if (dbaccess.dbTeamAction(action, team, member)) {
            // True means success.
            teams(req, res);
        } else {
            console.error("DID NOT HAPPEN!");
            console.log("TEAM action ZZZZ ", req.body);
        }
    }

    for (let item in req.body) {
        let val = req.body[item];
        let tm, mb, act;
        switch (item) {
            case 'addteam':
                _processAction('addteam', val);
                break;
            case 'deleteteam':
                _processAction('deleteteam', val);
                break;
            case 'delete':
                const a = val.split("-");
                if (a && a.length >= 2) {
                    _processAction('delete', a[0], a[1]);
                }
                break;
            case 'add':
                if (req.body.newmember) {
                    _processAction('add', req.body.team, req.body.newmember);
                }
                break;
            case 'newmember':
                if (!req.body.add) {
                    _processAction('add', req.body.team, req.body.newmember);
                }
                break;
            case 'team':
                // ignore.
                break;
            case 'phasex':
                // Change challenge phase!
                dbaccess.changePhase(req.body.phasex);
                console.log("CHANGED PHASE to " + req.body.phasex)
                teams(req, res);
                break;
            default:
                console.log("IGNORE item ", item);
        }
    }
}

const robotMove = async function (req, res, errors) {
    let response = '';
    let robotid = null;
    let dir = null;
    for (let item in req.body) {
        let val = req.body[item];
        console.log("move " + item, val);
        if (item == 'robotid') {
            robotid = val;
        } else if (item == 'robotmove') {
            dir = val;
        }
    }
    if (dir && robotid) {
        response = await arduino.driveRobotLocal(robotid, null, dir);
    } else {
        response = 'Not enought params...';
    }
    res.end(response);
}

let chooseRobotForDriving = function (req, res, errors) {
    for (let item in req.body) {
        let val = req.body[item];
        console.log("ROBOT CHOSEN " + item, val);
    }
}

let robotDriving = function (req, res, errors) {
    const dbres = {};
    let availrobots = [];
    let activerobot = '';
    if (!activerobots || activerobots.length < 1) {
        errors = {
            message: 'Cannot drive robots yet. First need to go to Robots and initialize one or more.'
        };
    } else {
        //  console.log("ROBOTS: HERE is req object", req);
        const robots = dbaccess.getRobots();

        for (let robot of activerobots) {
            for (let r of robots) {
                if (robot == r.id) {
                    availrobots.push(r);
                }
            }
        }
        if (availrobots.length < 1) {
            errors = {
                message: 'Error getting active robot.'
            };
        } else {
            activerobot = availrobots[0].id;
        }
    }

    dbres.robots = availrobots;
    dbres.activerobot = activerobot;
    dbres.settings = dbaccess.getChallengeSettings();
    dbres.errors = errors;
    dbres.pagetitle = 'Robot Driving';


    const host = req.protocol + "://" + req.get('host');
    console.log("HERE is the host", host);
    dbres.robothost = host;

    console.log("HERE DA ROBOTS CALLED");
    return res.render('pages/robotdrive', dbres);
}

var robots = function (req, res, errors) {
    //  console.log("ROBOTS: HERE is req object", req);
    const dbres = {};
    dbres.robots = dbaccess.getRobots();
    dbres.settings = dbaccess.getChallengeSettings();
    dbres.errors = errors;
    dbres.pagetitle = 'Robots';

    console.log("HERE DA ROBOTS CALLED");
    return res.render('pages/robots', dbres);
}

var teams = function (req, res) {
    let robj = {
        pagetitle: 'Teams'
    }
    robj.robots = dbaccess.getRobots();
    robj.teams = dbaccess.getTeams();
    robj.participants = dbaccess.getParticipants();
    robj.settings = dbaccess.getChallengeSettings();
    robj.phases = phases;
    robj.pagetitle = 'Teams'
    //  console.log("HERE are the team C", robj.teams['Team C']);
    //  console.log("HERE DA OBJECT", robj);
    //  console.log("HERE are all participants", robj.participants);
    console.log("ROCKING TEAMS...");
    return res.render('pages/teams', robj);
}

showTimes = () => {
    let result = '';
    const times = process.env.TIMES || 5;
    for (let i = 0; i < times; i++) {
        result += i + ' ';
    }
    return result;
}

testing = (query) => {
    arduino.testing(query, 'Black');
}

router
    .get('/', (req, res) => res.render('pages/index', {
        pagetitle: 'Home'
    }))
    .get('/db', (req, res) => res.render('pages/db', {}))
    .post('/driverobot', chooseRobotForDriving)
    .post('/activaterobots', activateRobots)
    .post('/teamaction', teamAction)
    .post('/robotaction', robotAction)
    .post('/paction', participantAction)
    .post('/robotmove', robotMove)
    .get('/robots', robots)
    .get('/robotdrive', robotDriving)
    .get('/teams', teams)
    .get('/cool', (req, res) => res.send(cool()))
    .get('/times', (req, res) => res.send(showTimes()))
    .get('/testing', (req, res) => res.send(testing(req.query)))

initialize = () => {

    console.log("start on robot-controller called...")

    const cbmap = {
        "command": activity.processCommand,
        "user": activity.processUser
    };

    if (!config.init(process.env.SETTINGS)) {
        console.error("FATAL ERROR doing config setup!")
        return;
    }

    // Initialize 
    dbaccess.init(config);

    // Initialize the boards
    //  arduino.initRobots(config, dbaccess);

    activity.init(arduino, dbaccess);
    console.log("activity.init done");

    const surl = config.getConfigData("settings", "robot-server-url");
    robotServer.init(surl, cbmap);


    //  robotServer.joinChallenge("testchallenge");
}

initialize();

module.exports = router;