
var express = require('express');
var crypto = require('crypto');
var app = express();
var path = require('path');
const fs = require('fs');
var httpServer = require('http').createServer(app);

var io = require('socket.io')(httpServer, { 'pingInterval': 3000, 'pingTimeout': 10000 });

app.use(express.static('public'));

app.enable('trust proxy');

var ipallow = {};
ipallow["192.168.92.146"] = true;
ipallow["192.168.87.154"] = true;

app.get('/', function (req, res) {
	console.log("IP remoto: " + req.ip);
	//  if(ipallow[req.ip])
	res.sendFile(path.join(__dirname + '/videoconf.html'));
	//  else
	//	res.sendFile(path.join(__dirname+'/fail.html'));
	//__dirname : It will resolve to your project folder.
});

io.on('connection', function (socket) {

	try {
		//var address = socket.handshake.address.address;
		var address = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
		console.log('Nueva conexion IP Remota: ' + address);
	} catch (error) {
		console.log("Error:" + error);
	}



	socket.on('new-message', function (msg) {
		try {
			procesarMensage(toObject(msg), socket);
		} catch (exception) {
			console.log("No se pudo procesar mensaje:");
			console.log(exception);
			console.log(msg);
		}
		//io.sockets.emit('message', messages);
	});


	socket.on('disconnect', function () {
		// close user connection
		if (!socket.sala) {
			console.log("Conexion cerrada " + socket.usuario);
			hashPeers.delete(socket.usuario);
		} else {
			if (socket.ownerRom) {
				console.log(new Date().toLocaleString() + " Conexion cerrada sala: " + socket.sala + " propietario:" + socket.usuario);


				let sala = hashSalas.get(socket.sala)
				if (sala)
					sala.hashPeers.forEach(function (v, k, map) {
						if (socket.usuario != v.usuario) {
							console.log("Enviando mensaje de desconexion a:" + v.usuario)
							let msg = new SignalMsg(socket.usuario, v.usuario, "HangUp", "Sala desconectada", socket.sala)
							reenviarMsg(msg)
							//v.websocket.disconnect()
						}

					});

				console.log("Eliminando sala: " + socket.sala);
				hashSalas.delete(socket.sala);

			} else {
				try {
					console.log("Conexion cerrada sala: " + socket.sala + " usuario:" + socket.usuario);
					var sal = hashSalas.get(socket.sala);
					var tmp = sal.hashPeers;
					tmp.delete(socket.usuario);

					//enviar hangUp a propietario
					var msg = new SignalMsg(socket.usuario, sal.propietario, "HangUp", null, socket.sala);
					reenviarMsg(msg);


				} catch (exp) {

				}

			}
		}
	});
});


function toJSON(obj) {
	return JSON.stringify(obj);
}

function toObject(txt) {
	return JSON.parse(txt);
}


//Buscar manera de extaer el usuarion a partir de la conexion, para mayor seguridad

var SignalMsg = function (srcUser, dstUser, tipo, dato, rom) {
	this.srcUser = srcUser;
	this.dstUser = dstUser;
	//Invite,CreateRom,Offer,Answer,IceCandidate,HangUp,Error,Autenticate,AnswerInvite,Decline
	this.tipo = tipo;
	this.dato = dato;
	this.sala = rom;
};

var Peer = function (user, wscon) {
	this.usuario = user;
	// Online,SendOffer,SendAnswer,Ocupado
	this.estado = "Online";
	this.websocket = wscon;
};

var paramsRom = {};
//var tmpParams=new Object();
//tmpParams.iceServers={ iceServers: [{urls:"turn:192.168.92.146:3478?transport=tcp",username: "embergrm",
//credential: "234"}]
//};
//paramsRom["embergrm"]=tmpParams;

//tmpParams=new Object();
//tmpParams.iceServers={ iceServers: [{urls:"turn:192.168.87.250:3478?transport=tcp",username: "lacbay",
//credential: "234"}]
//};
//paramsRom["lacbay"]=tmpParams;

var credential = getTURNCredentials("teveo", "alimatic123");

//Hay problema con la autentificacion secreta con timestap
//por eso se usa textoplano
credential["username"] = "alinet";
credential["password"] = "123";

var Sala = function (propietario) {
	this.propietario = propietario;
	this.limite = 7;
	this.hashPeers = new Map();
	this.iceServers = [{ urls: "turn:turn1.alinet.cu:443?transport=tcp", username: credential["username"], credential: credential["password"] },
	{ urls: "turn:192.168.100.30:443?transport=tcp", username: credential["username"], credential: credential["password"] }];
};
var hashSalas = new Map();

var hashPeers = new Map();

function procesarMensage(msg, con) {
	//console.log("++++++++++++++++++ MENSAJE RECIVIDO ++++++++++++++++");
	//console.log(msg);
	//console.log("--------------- Fin --------------");

	//Implementar en cada caso verificar que ya exista una conexion entre los dos "Per"
	//excepto en Invite
	switch (msg.tipo) {
		case "Invite":
			result = checkState(msg);
			if (result == "Online") {
				//Marcamos si el usuario es supervisor
				if (msg.srcUser === "sup" + msg.sala){
					msg.userSupervisor = true
					console.log("Usuario supervisor registrado "+ msg.srcUser)
				}
					
				reenviarMsg(msg);
			}
			else {
				msg.tipo = "Error";
				msg.dato = result;
				console.log("++++++++++++++++++ MENSAJE ENVIADO ++++++++++++++++");
				console.log(msg);
				console.log("--------------- Fin --------------");
				//hashPeers.get(msg.srcUser).websocket.emit('message',toJSON(msg));
				con.emit('message', toJSON(msg));
			}
			break;
		case "EnableBroadcast":
		case "DisableBroadcast":
		case "RestartIce":
		case "AnswerInvite":
		case "Offer":
		case "Answer":
		case "IceCandidate":
		case "DisableVideo":
		case "DisableAudio":
			reenviarMsg(msg); break;
		case "HangUp":
			if (!msg.sala) {
				hashPeers.get(msg.srcUser).estado = "Online";
				hashPeers.get(msg.dstUser).estado = "Online";
			}
			reenviarMsg(msg);
			break;
		case "Autenticate":
			var res = registrar(msg, con);
			msg.dato = res;
			con.emit('message', toJSON(msg));
			break;
		case "CreateRom":
			var res = createRom(msg, con);
			msg.dato = res;
			console.log("++++++++++++++++++ MENSAJE ENVIADO a:" + msg.srcUser);
			console.log(msg);
			console.log("--------------- Fin --------------");
			con.emit('message', toJSON(msg));
			break;
	}

}
function registrar(msg, con) {
	login = msg.dato;
	if (!msg.sala) {
		var result = hashPeers.get(login.user);
		if (!result && login.user) {
			console.log("Usuario " + login.user + " registrado");
			var newPeer = new Peer(login.user, con);
			con.usuario = login.user;
			hashPeers.set(login.user, newPeer);
		} else {
			console.log("Usuario " + login.user + " ya inicio secion");
			return "Usuario ya existe";
		}

	} else {
		var sal = hashSalas.get(msg.sala);
		if (!sal) {
			console.log("No existe la sala");
			console.log(hashSalas);
			return { res: "No existe la sala" };
		}
		if (sal.hashPeers.size >= sal.limite ) {
			console.log(login.user + " Sala llena");
			return { res: "Sala llena" };	
		}
		var hpeers = sal.hashPeers;
		var usercon = hpeers.get(login.user);
		if (usercon) {
			console.log("Usuario " + login.user + " ya inicio secion");
			return { res: "Usuario ya existe" };
		}
		con.usuario = login.user;
		con.sala = msg.sala;
		hpeers.set(login.user, con);
		console.log("Usuario " + login.user + " registrado en sala: " + msg.sala);
		//Poner el propietario de la sala
		msg.dstUser = sal.propietario;
		return { res: "OK", iceServers: sal.iceServers };

	}

}
function createRom(msg, con) {
	var res = hashSalas.get(msg.sala);
	if (res) {
		res = "La sala " + msg.sala + " ya existe";
		return { res: res };
	}


	var sal = new Sala(msg.srcUser);
	var tmpIce = paramsRom[msg.sala];
	if (tmpIce)
		sal.iceServers = tmpIce.iceServers;
	//else
	//{
	//	res="Lo sentimos por el momento esta funcion esta reservada para algunas entidades debido a problemas con el servidor TURN virtualizado en ETECSA.";
	//	return {res: res};
	//}	
	var peers = sal.hashPeers;
	hashSalas.set(msg.sala, sal);
	con.usuario = msg.srcUser;
	con.sala = msg.sala;
	con.ownerRom = true;
	peers.set(msg.srcUser, con);

	console.log(new Date().toLocaleString() + " Sala creada: " + msg.sala + " propietario:" + msg.srcUser);
	var dato = { res: "OK", iceServers: sal.iceServers };
	return dato;
}

function reenviarMsg(msg) {
	if (!msg.sala) {
		var p = hashPeers.get(msg.dstUser);
		//console.log("++++++++++++++++++ MENSAJE ENVIADO a:"+p.websocket.usuario);
		//console.log(msg);
		//console.log("--------------- Fin --------------");
		p.websocket.emit('message', toJSON(msg));
	} else {
		var s = hashSalas.get(msg.sala);
		if (!s)
			return "No existe la sala";
		var hpeers = s.hashPeers;
		var usercon = hpeers.get(msg.dstUser);
		if (!usercon)
			return "Usuario desconectado";
		if (!usercon.connected)
			return "Usuario desconectado";

		//console.log("++++++++++++++++++ MENSAJE ENVIADO a:"+msg.dstUser+" sala: "+msg.sala);
		//console.log(msg);
		//console.log("--------------- Fin --------------");

		usercon.emit('message', toJSON(msg));

	}

}


function checkState(msg) {
	if (!msg.sala) {
		var dstUser = msg.dstUser;
		var peerDst = hashPeers.get(dstUser);
		if (peerDst)
			if (peerDst.websocket.connected)
				return "Online";

		return "Usuario desconectado";
	} else {

		var s = hashSalas.get(msg.sala);
		if (!s) {
			console.log("No existe la sala");
			return "No existe la sala";
		}
		var hpeers = s.hashPeers;
		var usercon = hpeers.get(msg.dstUser);
		if (!usercon)
			return "Usuario desconectado";
		if (!usercon.connected)
			return "Usuario desconectado";

		return "Online";
	}

}


console.log(getTURNCredentials("david", "alimatic123"));


function getTURNCredentials(name, secret) {

	var unixTimeStamp = parseInt(Date.now() / 1000) + 24 * 3600,   // Las credenciales seran validas por 24 horas
		username = [unixTimeStamp, name].join(':'),
		password,
		hmac = crypto.createHmac('sha1', secret);
	hmac.setEncoding('base64');
	hmac.write(username);
	hmac.end();
	password = hmac.read();
	return {
		username: username,
		password: password
	};
}





httpServer.listen(3030, function () {
	console.log('listening on *:3030');
});





