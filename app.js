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

const portLocal = 5050;
const socketIO = require('socket.io');
const server = require('http').createServer();
const io = socketIO(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', function (socket) {
  console.log("USER CONNECTED WEB SERVER");

  socket.on('disconnect', function () {
    //    console.log("USER DISCONNECTED FROM WEB SERVER");
  })
})

server.listen(portLocal, () => {
  console.log("Local Server is up on " + portLocal);

  //  io.emit('newStuff', "DUDE IS HERE");
});


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