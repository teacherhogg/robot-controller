const io = require('socket.io-client');

const _priv = {
    serverurl: null,
    socket: null
}
const _helpers = {
    _init: function (serverurl, cbmap) {
        _priv.serverurl = serverurl;
        _priv.socket = io(_priv.serverurl);
        if (!_priv.socket) {
            console.error("ERROR getting socket for " + _priv.serverurl);
        }

        _priv.socket.on('connect', () => {
            console.log("SOCKET connected to " + _priv.serverurl);
        });
        _priv.socket.on('disconnect', function () {
            console.log("SOCKET disconnected from " + _priv.serverurl);
        });

        _priv.socket.on('newCommands', function (data) {
            //            console.log("HERE is the NEWCOMMANDS from server", data);

            if (data && data.length > 0) {
                if (cbmap["command"]) { cbmap["command"](data); }
            }

        });
        _priv.socket.on('newUsers', function (data) {
            //            console.log("HERE is the NEWUSERS from server", data);
            if (data && data.length > 0) {
                if (cbmap["user"]) { cbmap["user"](data); }
            }
        });
    }
}

const robotServer = {
    init: _helpers._init,
    joinChallenge: function (challenge) {
        console.log("Joining Challenge " + challenge);
        if (!_priv.socket) {
            console.error("NEED to initialize socket first!");
            return;
        }
        _priv.socket.emit('challenge', { challenge: challenge });
    }
}

module.exports = robotServer