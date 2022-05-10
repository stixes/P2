var express = require('express');
var app = express()
app.use(express.static("scripts"))
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var port = 3271

var arrayJason = []
io.on("connection", function(socket) {     
	console.log('a user connected,'+' id:' + socket.id)  // check connect
	socket.on('sendClientMidi', function(data){  // listen client
		arrayJason.push(data)               // save json to array (synchronous)
		console.log(arrayJason)  // check json on server
		setTimeout(() => {io.sockets.emit('sendServerMidi', arrayJason)}, 8000)
		//setTimeout(() => {arrayJason=[]}, 12000)  // delete arrays elementes
	});
});
 
// Render to web (socket.html) to communicate
app.get('/', function(req, res){
	res.sendFile(__dirname + '/PlayJSON.html');
});

http.listen(port, function(){
	console.log(`App listening at http://localhost:${port}`)
});
