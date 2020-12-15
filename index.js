// Load the dotenv file!
require('dotenv').config()

const config = require('./helpers/config')

const arduino = require('./helpers/arduino')
const activity = require('./helpers/activity')
const robotServer = require('./helpers/connect-server')

const cool = require('cool-ascii-faces')
const express = require('express')
const path = require('path')

const PORT = process.env.PORT || 5000

let app = express();
app
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
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
  arduino.testing(query);
}

start = () => {

  console.log("start on robot-controller called...")

  const cbmap = {
    "command": activity.processCommand,
    "user": activity.processUser
  };

  if (!config.init(process.env.SETTINGS)) {
    console.error("FATAL ERROR doing config setup!")
    return;
  }

  // Initialize the boards
  arduino.init(config);

  activity.init(config, arduino);

  const surl = config.getConfigData("settings", "robot-server-url");
  robotServer.init(surl, cbmap);

  //  robotServer.joinChallenge("testchallenge");
}

start();
// Start up in registration for challenge
modex();

