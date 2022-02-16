function myClickTest() {
    console.log("myClickTest has happenned!")
    alert("THIS IS A CLICK EH?");
}

/*
const socket = new WebSocket('ws://localhost:8080');
socket.addEventListener('open', function (event) {
    socket.send('Hello Server');
});

socket.addEventListener('message', function (event) {
    console.log("Message from server", event.data);
});

socket.addEventListener('close', function (event) {
    console.log("The connection was closed");
});
*/

var changeElementColor = function (id) {
    var oldHTML = document.getElementById(id).innerHTML;
    var newHTML = "<span class='bg-green-300'>" + oldHTML + "</span>";
    document.getElementById(id).innerHTML = newHTML;
}

var changeElementText = function (id, color, val) {
    document.getElementById(id).innerHTML = "<div class='" + color + "'>" + val + "</div>";
}

var changeElementText2 = function (id, val) {
    document.getElementById(id).innerHTML = "<span>" + val + "</span>";
}

const socket = io('http://localhost:5050');

socket.on('connect', () => {
    console.log("SOCKET connected to local server");
});

socket.on('disconnect', function () {
    console.log("SOCKET disconnected from ");
});

socket.on('commandInfo', function (data) {
//    console.log("HERE is commandInfo from server", data);
    changeElementText(data.username + '-command', 'bg-blue-200', data.command);
    changeElementText2(data.username + '-ncommands', data.ncommands);
    changeElementText2(data.username + '-ninstructions', data.ninstructions);
    changeElementText2(data.username + '-nblocked', data.nblocked);
});

socket.on('teamStats', function (data) {
//    console.log("HERE is teamStats from server", data);
    changeElementText2(data.teamid + '-total-ncommands', data.total_commands);
    changeElementText2(data.teamid + '-total-ninstructions', data.total_instructions);
    changeElementText2(data.teamid + '-total-nblocked', data.total_blocked);
});

socket.on('userInfo', function (data) {
    console.log("HERE is userInfo from server", data);
    changeElementColor(data.username);
});

socket.on('message', function (data) {
    changeElementText('idmessage', 'bg-red-800', data);
});