// Load the dotenv file!
require('dotenv').config()

const config = require('./helpers/config')

const arduino = require('./helpers/arduino')
const activity = require('./helpers/activity')
const dbaccess = require('./helpers/dataaccess')

const robotServer = require('./helpers/connect-server')

const cool = require('cool-ascii-faces')
const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')

const PORT = process.env.PORT || 5000

const sample = {
  results: [{
      name: 'Dude1',
      id: 'Dude ID 1'
    },
    {
      name: 'Dude2',
      id: 'Dude ID 2'
    },
    {
      name: 'Dude3',
      id: 'Dude ID 3'
    },
    {
      name: 'Dude4',
      id: 'Dude ID 4'
    },
    {
      name: 'Dude5',
      id: 'Dude ID 5'
    }
  ]
}

var activateRobots = function (req, res) {
  //  console.log("ACTIVATE: HERE is req object", req.body);
  /** req.body will be object with props the Robot ID and value
   * "on". If it is empty, that means NO robots are on.
   **/

  let active = null;
  if (active = dbaccess.updateActiveRobots(req.body)) {
    // Activate
    console.log("Activating Robots", active);

    // Initialize the boards
    arduino.initRobots(config, dbaccess, function (emsg) {
      console.log(emsg);

      // Start up in registration for challenge
      modex();
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
    }
  }

  //  console.log("TEAM action ZZZZ ", req.body);
  for (let item in req.body) {
    let val = req.body[item];
    let tm, mb, act;
    switch (item) {
      case 'addteam':
        _processAction('addteam', val);
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
      default:
        console.log("IGNORE item ", item);
    }
  }
}

var robots = function (req, res) {
  //  console.log("ROBOTS: HERE is req object", req);
  const dbres = {};
  dbres.robots = dbaccess.getRobots();
  dbres.pagetitle = 'Robots';

  //  console.log("HERE DA ROBOTS", dbres);
  return res.render('pages/robots', dbres);
}

var teams = function (req, res) {
  let robj = {
    pagetitle: 'Teams'
  }
  robj.robots = dbaccess.getRobots();
  robj.teams = dbaccess.getTeams();
  robj.participants = dbaccess.getParticipants();
  robj.pagetitle = 'Teams'
  //  console.log("HERE DA OBJECT", robj);
  //  console.log("HERE are all participants", robj.participants);
  return res.render('pages/teams', robj);
}

/*   .use(express.urlencoded({
      extended: true  
    }))
  .use(express.json())
*/

let app = express();
app
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.json())
  .use(express.urlencoded({
    extended: false
  }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index', {
    pagetitle: 'Home'
  }))
  .get('/db', (req, res) => res.render('pages/db', sample))
  .post('/activate', activateRobots)
  .post('/teamaction', teamAction)
  .post('/robotaction', robotAction)
  .post('/paction', participantAction)
  .get('/robots', robots)
  .get('/teams', teams)
  .get('/cool', (req, res) => res.send(cool()))
  .get('/times', (req, res) => res.send(showTimes()))
  .get('/modex', (req, res) => res.send(modex()))
  .get('/testing', (req, res) => res.send(testing(req.query)))
  .listen(PORT, () => console.log(`Listening on ${PORT}`))

app.locals.challenge = 'bigtest';

showTimes = () => {
  let result = '';
  const times = process.env.TIMES || 5;
  for (let i = 0; i < times; i++) {
    result += i + ' ';
  }
  return result;
}

modex = () => {

  config.changeMode();

}

testing = (query) => {
  arduino.testing(query, 'Black');
}


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

  activity.init(config, arduino, dbaccess);

  const surl = config.getConfigData("settings", "robot-server-url");
  robotServer.init(surl, cbmap);

  //  robotServer.joinChallenge("testchallenge");
}

initialize();