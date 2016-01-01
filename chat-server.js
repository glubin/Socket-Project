// Require the packages we will use:
var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("static/client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(1337);


var userObjects = [];
var chatroomObjects = [];
var banList = [];

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.


	socket.on('room_message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.

		console.log(data["message"] + " in room " + data["room"] + " was sent by " + data["sentBy"] + " aka " + data["uniqueID"] + " also color is " + data['userColor']); // log it to the Node.JS output
		
		// emit only to users in certain rooms
		for (var i=0; i < userObjects.length; i ++){
			if(userObjects[i].message.room === data["room"]){
				console.log("you know you have to emit here!" + userObjects[i].message.room);
				io.to(userObjects[i].message.uniqueID).emit("room_message_to_client",{message:data["message"], room:data["room"], sentBy:data['sentBy'], colorToAdd:data['userColor'] });
			}
		}

		for (var j=0; j<userObjects.length; j++){
			if (data['uniqueID'] === userObjects[j].message.uniqueID){
				userObjects[j].message.roomMessagesSent = userObjects[j].message.roomMessagesSent + 1;
				console.log(" room count is now " + userObjects[j].message.roomMessagesSent);
			}
		}

		// io.sockets.emit("room_message_to_client",{message:data["message"], room:data["room"], sentBy:data['sentBy'] }); // broadcast the message to other users
	});


socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.

		console.log(data["message"] + " was sent by " + data["sentBy"] + " in the lobby" + data["uniqueID"] + " you want a color of " + data['userColor']); // log it to the Node.JS output
		io.sockets.emit("message_to_client",{message:data["message"], sentBy:data["sentBy"], colorToAdd:data['userColor'] }); // broadcast the message to other users

		// get this working - isn't getting unique id
		for (var i=0; i<userObjects.length; i++){
			if (data['uniqueID'] === userObjects[i].message.uniqueID){
				userObjects[i].message.lobbyMessagesSent = userObjects[i].message.lobbyMessagesSent + 1;
				console.log(" your main lobby count is now " + userObjects[i].message.lobbyMessagesSent);
			}
		}

	});

socket.on('create_user', function(data){
	userObjects.push(data);
	console.log(data.message.name + " aka " + data.message.uniqueID + " joined the lobby with a color of " + data.message.color);
	io.sockets.emit("update_chatroom_list", {message:chatroomObjects, userList:userObjects});

});

socket.on('create_chatroom', function(chatroomInfo){
	chatroomObjects.push(chatroomInfo);
	console.log(chatroomInfo.message.admin + " is the admin for " + chatroomInfo.message.roomName + " with a password of " + chatroomInfo.message.password);
	io.sockets.emit("update_chatroom_list", {message:chatroomObjects, userList:userObjects});
});


socket.on('update_user_room', function(data){

	for (var i=0; i< userObjects.length; i++){
		if (userObjects[i].message.name === data.user){
			userObjects[i].message.room = data.room;
			console.log(userObjects[i].message.name + " is now in " + userObjects[i].message.room);
		}
	}

	io.sockets.emit("update_chatroom_list", {message:chatroomObjects, userList:userObjects});


});

socket.on('update_room_users', function(data){
		// update the users listed on the chat- socket.on --- show the users at the top for now
		
		var usersInRoom = "Users In This Room ";
		for (var c=0; c< userObjects.length; c++){
			if (userObjects[c].message.room === data.room){
				usersInRoom = usersInRoom + " | " + userObjects[c].message.name;
			}
		}
		console.log(usersInRoom + "are your friends in the chatroom");
		io.sockets.emit("update_userList_in_chatroom", {users : usersInRoom});
	});


socket.on('check_user_guess_at_password', function(data){
		// console.log(data['userGuess'] + " is what you want to check for room "+ data['room'] + " also " + data['uniqueID'] + " and " + data['user']);
		var roomToEnter = data['room'];
		var uniqueID = data['uniqueID'];
		var username = data['user'];
		var bannedBool = false;

		// check if not banned
		console.log("the list of banned users is " + banList.length);

		for (var j=0;j<banList.length; j++){
			console.log("here is an object " + JSON.stringify(banList[j]));
			if (username === banList[j].name && roomToEnter === banList[j].room){
				console.log("you were banned!");
				bannedBool = true;
			}
		}

		if (bannedBool === false){
		// we need to check userGuess and room to check
		for (var i=0;i<chatroomObjects.length; i++){
			// console.log(chatroomObjects[i].message.password + " is the actual password for " + chatroomObjects[i].message.roomName);
			if (chatroomObjects[i].message.roomName === data['room'] && data['userGuess'] === chatroomObjects[i].message.password){
				console.log("you guessed the correct password!");
				io.to(uniqueID).emit('allow_entrance_into_room', {room:roomToEnter,username:username});
			}
		}
	}
});


socket.on('check_if_admin', function(data){
	console.log("are you the admin " + data['user'] + " for " + data['room']);
	for (var i=0; i<chatroomObjects.length; i++){
		if (chatroomObjects[i].message.roomName === data['room']){
			if (chatroomObjects[i].message.admin === data['user']){
				console.log("you're the admin " + data['user'] + ", and id is "+ data['uniqueID']);
					// show the admin panel
					uniqueID = data['uniqueID'];
					io.to(uniqueID).emit('show_admin_panel', {uniqueID:uniqueID});
				}
			}
		}
	});


socket.on('user_is_leaving_room', function(data){
	console.log("from the server: " + data['username'] + " wants to leave " + data['room']);
	for (var i=0; i<userObjects.length; i++){
		if (userObjects[i].message.name === data['username']){
			userObjects[i].message.room = null;
			io.sockets.emit("leaving_user_now_update", {room:data['room'], user:data['username']});

		}
	}
});



socket.on('temp_kick_out_user', function(data){
	console.log(data['userToKick'] + " - get kicked out of - " + data['roomToKickOutOf']);
	for (var i=0; i<userObjects.length; i++){
		if (userObjects[i].message.name === data['userToKick'] && userObjects[i].message.room === data['roomToKickOutOf']){
				// update user so that his room is in the main lobby
				io.sockets.emit("leaving_user_now_update", {room:data['roomToKickOutOf'], user:data['userToKick']});
				io.to(userObjects[i].message.uniqueID).emit('temp_kick_go_to_lobby', {uniqueID:uniqueID});

			}
		}
	});


socket.on('perm_kick_out_user', function(data){
	console.log(data['userToKick'] + " - get perm kicked out of - " + data['roomToKickOutOf']);

	for (var i=0; i<userObjects.length; i++){
		if (userObjects[i].message.name === data['userToKick'] && userObjects[i].message.room === data['roomToKickOutOf']){
				// update user so that his room is in the main lobby
				userToBan = data['userToKick'];
				roomToBanFrom = data['roomToKickOutOf'];
				var bannedUserInfo = {};
				bannedUserInfo.name = userToBan;
				bannedUserInfo.room = roomToBanFrom;
				console.log(bannedUserInfo.name + " --- " + bannedUserInfo.room);
				banList.push(bannedUserInfo);

				io.sockets.emit("leaving_user_now_update", {room:data['roomToKickOutOf'], user:data['userToKick']});
				io.to(userObjects[i].message.uniqueID).emit('temp_kick_go_to_lobby', {uniqueID:uniqueID});

			}
		}


	});



socket.on('verify_open_room_ban', function(data){
	console.log("to check: " + data['room'] + ", " + data['username'] + ", " + data['uniqueID']);
	var bannedBool = false;

	for (var j=0;j<banList.length; j++){
		if (data['username'] === banList[j].name && data['room']  === banList[j].room){
			console.log("you were banned!");
			bannedBool = true;
		}
	}

	if (bannedBool === false){
		io.to(data['uniqueID']).emit('open_room_was_verified_no_ban', {room:data['room'],username:data['username']});
	}

});

socket.on('send_private_message', function(data){
	console.log("you want to send  " + data['messageContent'] + " to " + data['userSentTo'] + " from " + data['userComingFrom'] + " aka " + data['uniqueID'] + " in room " + data['currRoom']);
	var uniqueIDComingFrom = data['uniqueID'];
	var uniqueIDToSendTo = "";

	for (var i=0; i<userObjects.length; i++){
		if (userObjects[i].message.name === data['userSentTo'] && userObjects[i].message.room === data['currRoom']){
			console.log("you are set to send to " + userObjects[i].message.name + " in room " + userObjects[i].message.room);
			uniqueIDToSendTo = userObjects[i].message.uniqueID;
			io.to(uniqueIDComingFrom).emit('display_private_message', {message:data['messageContent'], sentBy:data['userComingFrom'], sentTo:data['userSentTo'], colorToAdd:data['userColor'] });
			io.to(uniqueIDToSendTo).emit('display_private_message', {message:data['messageContent'], sentBy:data['userComingFrom'], sentTo:data['userSentTo'], colorToAdd:data['userColor'] });

			// update counts
			for (var j=0; j<userObjects.length; j++){
				if (data['userComingFrom'] === userObjects[j].message.name){
					userObjects[j].message.privateMessagesSent = userObjects[j].message.privateMessagesSent + 1;
					console.log(" private count is now " + userObjects[j].message.privateMessagesSent);
				}
				if (data['userSentTo'] === userObjects[j].message.name){
					userObjects[j].message.privateMessagesGot = userObjects[j].message.privateMessagesGot + 1;
					console.log(" private sent to you is now " + userObjects[j].message.privateMessagesGot);
				}
			}



		}
	}
});

socket.on('get_user_stats', function(data){
	console.log(data['username'] + " -!-!- " + data['uniqueID']);
	for (var i=0; i<userObjects.length; i++){
		if (data['uniqueID'] === userObjects[i].message.uniqueID){
			var lobbyStat = userObjects[i].message.lobbyMessagesSent;
			var roomStat = userObjects[i].message.roomMessagesSent;
			var privateSentStat = userObjects[i].message.privateMessagesSent;
			var privateGotStat = userObjects[i].message.privateMessagesGot;
			io.to(data['uniqueID']).emit('update_your_stats', {lobbyStat:lobbyStat,roomStat:roomStat,privateSentStat:privateSentStat,privateGotStat:privateGotStat});
		}
	}
});







io.on('connection', function (socket) {
	console.log("user is connected!");
	var uniqueID = socket.id;
	console.log(uniqueID + " is your unique ID");
	io.to(uniqueID).emit('give_user_socket_ID', {uniqueID:uniqueID});


	socket.on('disconnect', function () {
		console.log(socket.id + " left the site!");
		console.log("length is " + userObjects.length);
		console.log(userObjects);
		for (var i=0; i<userObjects.length; i++){
			console.log("is " + userObjects[i].message.uniqueID + " equal to " + socket.id);
			if (userObjects[i].message.uniqueID === socket.id){
				console.log("the user info is " + userObjects[i].message.name + ", " + userObjects[i].message.uniqueID + ", " + userObjects[i].message.room);
				roomWasIn = userObjects[i].message.room;
				userLeaving = userObjects[i].message.name;
				userObjects.splice(i, 1);
				io.sockets.emit("leaving_user_now_update", {room:roomWasIn, user:userLeaving});
			}
		}
			// get rid of their object and remove them from the group they are in, etc. do updates
		});
});






});

