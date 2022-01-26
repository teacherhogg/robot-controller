const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
var index = require('./routes/index');

const PORT = process.env.PORT || 5000

// DO THIS 
//const io = require('socket.io')()
// OR THIS
// const { Server } = require('socket.io');
// const io = new Server(3000);


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
  .use('/', index)
  .listen(PORT, () => console.log(`Listening on ${PORT}`))

// app.locals.challenge = 'bigtest';

module.exports = app;