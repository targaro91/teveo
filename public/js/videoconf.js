'use strict';

// Para la mezcla de  stream audio
var ac1;
var mezcla=true;
//

//var socket = io.connect('https://alical.alimaticgr.alinet.cu:443');
var socket;
var test;
// Online,SendOffer,SendAnswer,Ocupado
var estado = "Online";
//Nombre de la sala
var sala = null;
//Usuario propietario de la sala
var propietario = null;
var usuarioActual = null;
//RTCPeerConnection si es null es que es un propietario 
var pc = null;
var participanteDifundido = null;
var hashParticipantes = null;
var difundio = false;
var chromePlanB = false;


var debug = true;
var debugmessage = true;


var joinButton = document.getElementById('joinButton');
//var hangupButton = document.getElementById('hangupButton');
var createRomButton = document.getElementById('createRomButton');

joinButton.disabled = false;
//hangupButton.disabled = true;
joinButton.onclick = autentificar;
createRomButton.onclick = requestCreateRoom;

var startTime;
var localVideo = null;
var broadcastStream = null;
var broadcastTrackVideo = null;
//var remoteVideo = document.getElementById('remoteVideo');
var remoteVideo = null;
var localStream = null;
var buttonDifundir;
var buttonToggleMute;


//var ws = new WebSocket("ws://192.168.92.146:8080");
var ws = null;
var iceServers = null;
var supportBroadcast = false;


window.onload = inicializar;

function inicializar() {
	socket = io();

	socket.on('message', function (data) {
		if (debugmessage) {
			trace("Mensage recivido");
			//trace(data);
		}

		procesarMsg(toObject(data));
	});

	socket.on('disconnect', function () {
		alert("Conexión perdida con el servidor")
		location.reload();
	});

	console.log("TeVeo Desarrollador: Antonio David Perera Calas");

	window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;



	try {
		var download = 'http://download.jovenclub.cu/GUTL/Aplicaciones_Softwares/Windows/Internet/google-chrome/';
		var navegador = getBrowserInfo();
		var arr = navegador.split(" ");
		if ((arr[0].toLocaleLowerCase() == "chrome" && parseInt(arr[1]) >= 72)) {
			supportBroadcast = true;
		} else if ((arr[0].toLocaleLowerCase() == "firefox" && parseInt(arr[1]) >= 58)) {
			supportBroadcast = true;
			alert("Esta aplicacion es compatible con firefox pero si navega a traves de un proxy puede no funcionar, en ese caso use Chrome 72 o superior.");
		}
		else {
			alert("Navegador no compatible, necesita Google Chrome >=72  o Firefox >=58.");
		}

	} catch (error) {
		trace("Error al buscar navegador " + error);
		supportBroadcast = false;
	}

	trace("Soporte de difusion: " + supportBroadcast);



}

var Participante = function (n) {
	this.nombre = n;
	this.video = null;
	this.button = null;
	this.div = null;
	this.streamReceiver = null;//Stream de la webcam del participante
	this.streamSender = null;//Stream que se le envia al participante
	this.pc;
	this.broadcast = false;
	this.supportBroadcast = true;
	this.limpiar = function () {
		this.div.parentNode.removeChild(this.div);
	};
};




function requestCreateRoom() {
	if (!supportBroadcast) {
		alert("Lo sentimos su versión de navegador no es compatible con esta aplicación.");
	} else {
		propietario = document.getElementById('inputUsuario').value.toLowerCase();
		sala = document.getElementById('inputSala').value.toLowerCase();
		var msg = new SignalMsg(propietario, null, "CreateRom", null, sala);
		if (propietario.length > 0 && sala.length > 0)
			enviarMsg(msg);
		else
			alert("Defina la sala y el usuario");
	}

}

function crearSala(stream) {
	trace("Creando sala");
	estado = "Online";
	hashParticipantes = new Map();
	eliminarDivAccion();
	inicializarSala();
	inicializarVideo();
	ac1 = new AudioContext();



	if (stream)
		gotStream(stream);

	trace("Sala creada");

}

function inicializarSala() {
	let h = document.getElementById("highlight");
	let menu = document.createElement("ul");
	menu.id = "menu";
	h.appendChild(menu);
	var li = document.createElement("li");
	menu.appendChild(li);

	buttonToggleMute = document.createElement("i");
	buttonToggleMute.className = "icofont-mic toggleMute"
	buttonToggleMute.onclick = function () { toggleMute(true) }
	buttonToggleMute.muted = false

	li.appendChild(buttonToggleMute);

	buttonDifundir = document.createElement("button");
	buttonDifundir.className = "verde menu";
	buttonDifundir.innerText = "Difundiendo";
	buttonDifundir.disabled = true;
	buttonDifundir.onclick = function () {
		recuperarFuente();

	};
	participanteDifundido = propietario;

	li.appendChild(buttonDifundir);

	li = document.createElement("li");
	menu.appendChild(li);

	let buttonOut = document.createElement("button");
	buttonOut.className = "azul menu";
	buttonOut.innerText = "Salir";
	buttonOut.onclick = requestHangUp;

	li.appendChild(buttonOut);

	//Captura de tecla 'm' para activar el micro
	document.addEventListener('keypress', (e) => {
		if (e.key === 'm')
			toggleMute(true)
	})

}

function inicializarParticipante() {
	var h = document.getElementById("highlight");
	var menu = document.createElement("ul");
	menu.id = "menu";
	h.appendChild(menu);
	var li = document.createElement("li");
	menu.appendChild(li);

	buttonToggleMute = document.createElement("i");
	buttonToggleMute.className = "icofont-mic-mute toggleMute toggleMuteEnable"
	buttonToggleMute.onclick = handleToggleMute
	buttonToggleMute.muted = true

	li.appendChild(buttonToggleMute);

	buttonDifundir = document.createElement("button");
	buttonDifundir.className = "rojo menu";
	buttonDifundir.innerText = "Difundir";
	buttonDifundir.disabled = true;
	buttonDifundir.onclick = null;
	li = document.createElement("li");
	menu.appendChild(li);
	li.appendChild(buttonDifundir);

	li = document.createElement("li");
	menu.appendChild(li);

	let buttonOut = document.createElement("button");
	buttonOut.className = "azul menu";
	buttonOut.innerText = "Salir";
	buttonOut.onclick = requestHangUp;

	li.appendChild(buttonOut);


	//Captura de tecla 'm' para activar el micro
	document.addEventListener('keypress', (e) => {
		if (e.key === 'm')
			handleToggleMute()
	})

}


function eliminarDivAccion() {
	var cont = document.getElementById("container");
	var elem = document.getElementById("accion");
	cont.removeChild(elem);
	document.body.removeChild(document.getElementsByTagName('footer')[0])
}


function enableBroadcast() {
	buttonDifundir.className = "verde menu";
	buttonDifundir.innerText = "Difundiendo";

}

function disableBroadcast() {
	buttonDifundir.className = "rojo menu";
	buttonDifundir.innerText = "Difundir";
}

function inicializarVideo(participante) {
	trace("Icicializando video");
	var divcontainer = document.getElementById("container");

	if (!participante) {
		var item = document.createElement('video');
		item.id = "localVideo";
		item.autoplay = true;
		item.muted = true;
		item.className = "videoLocalPropietario";
		divcontainer.appendChild(item);
		localVideo = item;

		//Boton Intervenir
		//var itemB = document.createElement('button');
		//itemB.id="broadcastIcon";
		//itemB.onclick=recuperarFuente;
		//itemB.innerText="B";
		//itemB.className="broadcastIcon";
		//divcontainer.appendChild(itemB);
		//itemB.disabled=true;

		localVideoEvent();
	} else {
		var itemP = document.createElement('p');
		itemP.id = "labelDifundido";
		itemP.className = "uname";
		itemP.innerText = participanteDifundido;

		var vremoteVideo = document.createElement('video');
		vremoteVideo.id = "remoteVideo";
		vremoteVideo.className = "remoteVideo";
		vremoteVideo.autoplay = true;
		//vremoteVideo.width=window.innerWidth/2;
		var vlocalVideo = document.createElement('video');
		vlocalVideo.id = "localVideo";
		vlocalVideo.autoplay = true;
		vlocalVideo.muted = true;
		vlocalVideo.className = "videoLocalPropietario"; //prueba

		var divRemote = document.createElement('div');
		divRemote.id = "divRemoteVideo";

		divcontainer.appendChild(vlocalVideo);//prueba

		divRemote.appendChild(vremoteVideo);
		divRemote.appendChild(itemP);
		divcontainer.appendChild(divRemote);

		remoteVideo = vremoteVideo;
		//dcremote.append(dclocal);
		//dclocal.append(vlocalVideo);
		localVideo = vlocalVideo;

		localVideoEvent();
		remoteVideoEvent()
	}


}



var SignalMsg = function (srcUser, dstUser, tipo, dato, rom) {
	this.srcUser = srcUser;
	this.dstUser = dstUser;
	this.tipo = tipo;// Invite,Offer,Answer,IceCandidate,HangUp,Error,AnswerInvite,Decline
	this.dato = dato;
	this.sala = rom;
};




function enviarMsg(msg) {
	if (debugmessage)
		trace("Enviando mensaje:\n" + msg);
	socket.emit('new-message', toJSON(msg));
}
function procesarMsg(signalMsg) {
	switch (signalMsg.tipo) {
		case "DisableAudio":
			//Lo reciven ambos
			disableAudio(signalMsg);
			break;
		case "DisableVideo":
			//Solo lo recive el participante
			disableVideo(signalMsg.dato);
			break;
		case "RestartIce":
			restartIceOffer();
			break;
		case "Invite": //solo lo recive el propietario
			agregarParticipante(signalMsg);

			break;
		case "Offer": //solo lo recive un participante
			procesarOferta(signalMsg);
			break;
		case "Answer"://solo lo recive el propietario
			procesarRespuesta(signalMsg);
			break;
		case "EnableBroadcast"://solo lo recive un participante
			enableBroadcast();
			break;
		case "DisableBroadcast"://solo lo recive un participante
			disableBroadcast();
			break;
		case "HangUp":
			trace("Recivida solicitud de hangUp.");
			hangUp(signalMsg.srcUser, signalMsg.dato);
			break;
		case "Error":
			alert("Error :" + signalMsg.dato);
			//setOnline();
			break;
		case "IceCandidate":
			agregarIceCandidate(signalMsg.dato, signalMsg.srcUser);
			break;
		case "Autenticate": //solo lo recive un participante
			if (signalMsg.dato.res != "OK")
				alert(signalMsg.dato.res);
			else {
				iceServers = signalMsg.dato.iceServers;
				iniciarLlamada(signalMsg);
			}


			break;
		case "CreateRom":
			if (signalMsg.dato.res == "OK") {
				iceServers = signalMsg.dato.iceServers;
				start(crearSala);
			}

			else
				alert(signalMsg.dato.res);
			break;
		default: { mensajeDesconocido(signalMsg); break; }

	}

}

//Cuando se resiva la respuesta de Autenticate
function modoParticipante() {
}

//Metodo ejecutado por el propietario
function agregarParticipante(signalMsg) {
	trace("Recivido Invite:\n" + signalMsg);
	trace("Agregando Participante: " + signalMsg.srcUser);


	var par = new Participante(signalMsg.srcUser);

	trace("Soporte de difusion: " + signalMsg.dato.supportBroadcast);
	par.supportBroadcast = signalMsg.dato.supportBroadcast;
	//Si el usuario es supervisor no agregar video 
	if (!signalMsg.userSupervisor)
		appendVideo(par);
	hashParticipantes.set(signalMsg.srcUser, par);
	//para mezcla de audio
	//par.ac = new AudioContext();
	par.mediaStreamDestination = new MediaStreamAudioDestinationNode(ac1);
	//Prueba para mezcla de audio
	let localAudioTrack = localStream.getAudioTracks()[0]

	if (localAudioTrack) {
		let mediaStream = new MediaStream();
		mediaStream.addTrack(localAudioTrack);
		let mediaStreamSource = new MediaStreamAudioSourceNode(ac1, { mediaStream: mediaStream });
		par.mediaStreamSource = mediaStreamSource;
		mediaStreamSource.connect(par.mediaStreamDestination);
	}

	//Creando RTCPeerConnection
	par.pc = createRTCPeerConnection();

	par.pc.onicecandidate = function (e) { onIceCandidate(e, par); };
	par.pc.onconnectionstatechange = function (e) { onConnectionStateChange(e, signalMsg.srcUser); };
	par.pc.oniceconnectionstatechange = function (e) { onIceStateChange(e, signalMsg.srcUser); };
	par.pc.ontrack = function (e) { gotRemoteStream(e, par); };
	//par.pc.onaddstream = function(e){gotRemoteStream(e,par);}; 
	par.pc.onnegotiationneeded = function (e) {
		onNegotiationNeeded(e, signalMsg.srcUser);
	};

	let stream = new MediaStream();


	if (broadcastTrackVideo) {
		trace("Agregando broadcastTrackVideo a: " + signalMsg.srcUser);
		//Segun pruebas realizadas se debe  agregar primero el videoTrack al stream
		stream.addTrack(broadcastTrackVideo);
	}
	stream.addTrack(par.mediaStreamDestination.stream.getAudioTracks()[0]);

	addStreamToParticipante(stream, par);


	//Crear oferta
	crearOferta(par);
}

//function renegociar(participante) 
//{
//	crearOferta(participante);	
//}

function recuperarFuente() {
	participanteDifundido = propietario;
	broadcastStream = localStream;
	broadcastTrackVideo = getVideoTrack(localStream);

	hashParticipantes.forEach(function (v, k, map) {

		if (v)
			if (v.streamSender.getVideoTracks()[0] !== localStream.getVideoTracks()[0]) {
				removeVideoTrackOfParticipante(v);
				//v.pc.removeStream(v.pc.getLocalStreams()[0]);

				addVideoTrackToParticipante(localStream.getVideoTracks()[0], v);

				crearOferta(v);
			} else if (v.broadcast) {
				propietarioDisableBroadcast(v);
			}


	});

	buttonDifundir.className = "verde menu";
	buttonDifundir.innerText = "Difundiendo";

}

function propietarioDisableBroadcast(participante) {
	participante.broadcast = false;
	participante.button.disabled = false;
	participante.button.innerText = "Difundir";
	participante.buttonDifundir.disabled = false;
	participante.buttonDifundir.className = "icofont-eye-alt partButtonDifundir"
	var msg = new SignalMsg(propietario, participante.nombre, "DisableBroadcast", null, sala);
	enviarMsg(msg);
}

function getVideoTrack(stream) {
	return stream.getVideoTracks().length > 0 ? stream.getVideoTracks()[0] : null


}

function cambiarFuente(participante) {
	if (!participante.streamReceiver) {
		return false;
	} else if (participante.streamReceiver.getVideoTracks().length === 0)
		return false;

	trace("Difundiendo al participante: " + participante.nombre);

	difundio = false;
	participanteDifundido = participante.nombre;
	broadcastStream = participante.streamReceiver;
	broadcastTrackVideo = getVideoTrack(participante.streamReceiver);

	hashParticipantes.forEach(
		function (v, k, map) {
			if (v)
				if (v.nombre != participante.nombre && v.supportBroadcast == true) {
					difundio = true;

					if (v.broadcast)
						propietarioDisableBroadcast(v);

					trace("Cambiando stream de participante: " + v.nombre);
					removeVideoTrackOfParticipante(v);
					addVideoTrackToParticipante(getVideoTrack(participante.streamReceiver), v);
					//v.pc.addStream(participante.stream);

					//Verificar que el usuario no sea supervisor
					if (v.video) {
						v.button.disabled = false;
						v.buttonDifundir.disabled = false;

					}


					//renegociar
					crearOferta(v);
				} else {
					if (getVideoTrack(v.streamSender) != getVideoTrack(localStream)) {
						trace("Recuperando difusion del propietario en participante: " + v.nombre);
						removeVideoTrackOfParticipante(v);
						addVideoTrackToParticipante(getVideoTrack(localStream), v);
						//v.pc.addStream(localStream);

						crearOferta(v);
					}
				}
		}
	);

	//if(difundio==true)
	//{
	trace("Se difundio a: " + participante.nombre);
	participante.broadcast = true;
	participante.button.disabled = true;

	participante.buttonDifundir.disabled = true;
	participante.buttonDifundir.className = "icofont-eye-alt partButtonDifundir partButtonDifundirEnable";

	participante.button.innerText = "Difundiendo";
	var msg = new SignalMsg(propietario, participante.nombre, "EnableBroadcast", null, sala);
	enviarMsg(msg);

	//Habilitar
	buttonDifundir.className = "rojo menu";
	buttonDifundir.innerText = "Difundirme";
	buttonDifundir.disabled = false;

	//}

}

function appendVideo(participante) {
	let divcontainer = document.getElementById("container");

	let divParticipante = document.createElement('div');
	divParticipante.className = "div-participante";

	divParticipante.ondblclick = function (event) {
		//Desconectar participante
		hangUp(participante.nombre, "Participante desconectado");

	}


	let item = document.createElement('video');
	//item.id="1";
	item.className = "videoRemoto"
	//item.width=widthRemoteVideo;
	item.autoplay = true
	item.muted = true
	item.disableVideo = false

	item.className = "vRemotoParticipante";

	let itemP = document.createElement('p');
	itemP.className = "uname";
	itemP.innerText = participante.nombre;

	divcontainer.appendChild(divParticipante);

	let itemDisableVideo = document.createElement('i');
	itemDisableVideo.className = "icofont-eye-blocked partButtonDisableVideo"
	itemDisableVideo.ondblclick = function (event) { event.stopPropagation(); }
	itemDisableVideo.onclick = function (event) {
		event.stopImmediatePropagation();


		if (item.disableVideo) {
			item.disableVideo = false;
			itemDisableVideo.className = "icofont-eye-blocked partButtonDisableVideo";


		}
		else {
			item.disableVideo = true;
			itemDisableVideo.className = "icofont-eye-blocked partButtonDisableVideo partButtonDisableVideoEnable";
		}

		console.log("DisableVideo: " + item.disableVideo)
		let msg = new SignalMsg(propietario, participante.nombre, "DisableVideo", item.disableVideo, sala);
		enviarMsg(msg);

	};

	let itemMuted = document.createElement('i');
	itemMuted.className = "icofont-volume-mute partButtonMute partButtonMuteEnable";
	itemMuted.ondblclick = function (event) { event.stopPropagation(); }
	itemMuted.onclick = function (event) {
		event.stopPropagation();
		let msg = new SignalMsg(propietario, participante.nombre, "DisableAudio", item.muted, sala);
		enviarMsg(msg);
		if (item.muted) {
			item.muted = false;
			itemMuted.className = "icofont-volume-mute partButtonMute";



		}
		else {
			item.muted = true;
			itemMuted.className = "icofont-volume-mute partButtonMute partButtonMuteEnable";
		}

	};

	let itemDifundir = document.createElement('i');
	itemDifundir.className = "icofont-eye-alt partButtonDifundir";
	itemDifundir.ondblclick = function (event) { event.stopPropagation(); }

	//Comentareado hasta que se solucione el cambiar fuente

	/* itemDifundir.onclick = function (event) {
		event.stopPropagation();
		if (!itemDifundir.disabled)
			cambiarFuente(participante)
	}; */

	let itemButton = document.createElement('button');
	itemButton.onclick = function () { cambiarFuente(participante) };
	itemButton.innerText = "Difundir";
	itemButton.className = "rojo difundir";

	if (supportBroadcast == false || participante.supportBroadcast == false) {
		itemButton.onclick = null;
		itemButton.className = "invisible difundir";
		itemButton.disabled = true;
	}

	let itemButtonMuted = document.createElement('button');
	itemButtonMuted.ondblclick = function (event) { event.stopPropagation(); }
	itemButtonMuted.onclick = function (event) {
		event.stopPropagation();
		if (item.muted) {
			item.muted = false;
			itemButtonMuted.innerText = "Silenciar";
			itemMuted.className = "icofont-volume-mute partButtonMute";


		}
		else {
			itemButtonMuted.innerText = "Escuchar";
			item.muted = true;
			itemMuted.className = "icofont-volume-mute partButtonMute partButtonMuteEnable";
		}

	};
	itemButtonMuted.innerText = "Silenciar";
	itemButtonMuted.className = "azul difundir";






	divParticipante.appendChild(itemMuted);
	divParticipante.appendChild(itemDisableVideo);
	divParticipante.appendChild(itemDifundir);


	//divParticipante.appendChild(itemButton);
	//divParticipante.appendChild(itemButtonMuted);
	divParticipante.appendChild(item);
	divParticipante.appendChild(itemP);

	participante.video = item;
	participante.button = itemButton;
	participante.buttonDifundir = itemDifundir;
	participante.buttonMuted = itemMuted;
	participante.buttonDisableVideo = itemDisableVideo;

	participante.div = divParticipante;
}
function autentificar() {
	if (!supportBroadcast) {
		alert("Lo sentimos su versión de navegador no es compatible con esta aplicación.");
	} else {
		usuarioActual = document.getElementById('inputUsuario').value;
		sala = document.getElementById('inputSala').value.toLowerCase();
		if (sala.length > 0 && usuarioActual.length > 0) {
			trace('Enviando autentifacion');
			var login = new Object();
			login.user = usuarioActual;
			var msg = new SignalMsg(usuarioActual, null, "Autenticate", login, sala);
			msg.tipo = "Autenticate"

			enviarMsg(msg);
		}
		else
			alert("Defina la sala y el usuario");

	}



}

function agregarIceCandidate(candidate, participante) {
	trace("Agregando IceCandidate: \n");
	/* if (candidate)
		trace('ICE candidate: \n' + candidate.candidate);
	else
		trace('ICE candidate: \n null'); */

	if (pc)
		pc.addIceCandidate(candidate).then(function () { onAddIceCandidateSuccess(); }, function (err) { onAddIceCandidateError(err); });
	else {
		var pcPart = hashParticipantes.get(participante).pc;
		pcPart.addIceCandidate(candidate).then(function () { onAddIceCandidateSuccess(); }, function (err) { onAddIceCandidateError(err); });

	}


}

function procesarRespuesta(signalMsg) {
	var part = hashParticipantes.get(signalMsg.srcUser);
	var pcPart = part.pc;
	trace('setRemoteDescription start sdp:\n' + signalMsg.dato.sdp);
	pcPart.setRemoteDescription(signalMsg.dato).then(function () {
		onSetRemoteSuccess(pcPart);
	}, onSetSessionDescriptionError);
}




function procesarOferta(signalMsg) {
	//var part=hashParticipantes.get(signalMsg.srcUser);
	participanteDifundido = signalMsg.dato["nombre"];
	var labelDifundido = document.getElementById("labelDifundido");
	labelDifundido.innerText = participanteDifundido;

	trace("Oferta recivida de propietario: " + signalMsg.srcUser);
	var desc = signalMsg.dato["desc"];

	trace('setRemoteDescription start sdp:\n' + desc.sdp);
	pc.setRemoteDescription(desc).then(
		function () {
			onSetRemoteSuccess(pc);
		},
		onSetSessionDescriptionError
	);

	pc.createAnswer().then(
		onCreateAnswerSuccess,
		onCreateSessionDescriptionError
	);


}

function crearOferta(par) {
	trace('Creando Oferta');
	par.pc.createOffer(
		offerOptions
	).then(function (desc) { onCreateOfferSuccess(desc, par); },
		onCreateSessionDescriptionError
	);
}



function toJSON(object) {
	return JSON.stringify(object);
}

function toObject(json) {
	return JSON.parse(json);
}

function localVideoEvent() {
	localVideo.addEventListener('loadedmetadata', function () {
		trace('Local video videoWidth: ' + this.videoWidth +
			'px,  videoHeight: ' + this.videoHeight + 'px');
	});

	localVideo.onresize = function () {
		trace('Video local resolucion cambiada a:' +
			localVideo.videoWidth + 'x' + localVideo.videoHeight);
		// We'll use the first onsize callback as an indication that video has started
		// playing out.
		if (startTime) {
			var elapsedTime = window.performance.now() - startTime;
			trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
			startTime = null;
		}
	};


}

function remoteVideoEvent() {
	remoteVideo.addEventListener('loadedmetadata', function () {
		trace('Remote video videoWidth: ' + this.videoWidth +
			'px,  videoHeight: ' + this.videoHeight + 'px');
	});

	remoteVideo.onresize = function () {
		trace('Video Remoto  resolucion cambiada a:' +
			remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
		// We'll use the first onsize callback as an indication that video has started
		// playing out.
		if (startTime) {
			var elapsedTime = window.performance.now() - startTime;
			trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
			startTime = null;
		}
	};


}








var offerOptions = {
	offerToReceiveAudio: 1,
	offerToReceiveVideo: 1
};


function gotStream(stream) {
	trace('Reciviendo local stream');
	localVideo.srcObject = stream;
	localStream = stream;

	broadcastStream = stream;
	broadcastTrackVideo = getVideoTrack(stream);



}

function toggleMute(ignore) {
	if (localStream && localStream.getAudioTracks().length > 0 && localStream.getAudioTracks()[0]) {
		localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled
		//localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled
		if (localStream.getAudioTracks()[0].enabled)
			buttonToggleMute.className = "icofont-mic toggleMute"
		else
			buttonToggleMute.className = "icofont-mic-mute toggleMute toggleMuteEnable"

		if (!ignore) {
			let msg = new SignalMsg(usuarioActual, propietario, "DisableAudio", !localStream.getAudioTracks()[0].enabled, sala);
			enviarMsg(msg);
		}


	}

}

/* function toggleMute(ignore) {

	if (!ignore) {
		let msg = new SignalMsg(usuarioActual, propietario, "DisableAudio", true, sala);
		enviarMsg(msg);
	}

} */

function handleToggleMute() {
	toggleMute(false)
}


function start(varfunction) {
	trace('Solicitud local stream');
	let quality = {
		low: {
			width: { min: 144, ideal: 144, max: 320 },
			height: { min: 144, ideal: 144, max: 240 }
		},
		medium: {
			width: { min: 144, ideal: 240, max: 320 },
			height: { min: 144, ideal: 240, max: 240 }
		}
	}

	var constraints = {
		audio: true,
		video: quality.low
	}


	navigator.mediaDevices.getUserMedia(constraints)
		.then(varfunction)
		.catch(function (e) {
			trace('getUserMedia() error: ' + e.name);
			var constraints2 = { audio: true, video: false };
			navigator.mediaDevices.getUserMedia(constraints2)
				.then(varfunction)
				.catch(function (e) {
					varfunction();
				});


		});
}

function iniciarLlamada(signalMsg) {
	trace("Iniciando llamada");
	sala = signalMsg.sala;
	propietario = signalMsg.dstUser;
	eliminarDivAccion();
	inicializarParticipante();
	inicializarVideo(true);
	start(requestCall);
}
function requestCall(stream) {
	if (usuarioActual && propietario) {

		if (stream && stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0]) {
			stream.getAudioTracks()[0].enabled = false
		}

		gotStream(stream);

		preparar();

		trace('Enviando Solicitud de llamada al propietario');
		var msg = new SignalMsg(usuarioActual, propietario, "Invite", { supportBroadcast: supportBroadcast }, sala);
		enviarMsg(msg);
	}



}

function preparar() {

	trace("Inicializando Local Peer Connection");

	startTime = window.performance.now();

	pc = createRTCPeerConnection();

	pc.onicecandidate = function (e) {
		onIceCandidate(e);
	};
	pc.onconnectionstatechange = function (e) {
		onConnectionStateChange(e);
	};
	pc.oniceconnectionstatechange = function (e) {
		onIceStateChange(e);
	};
	pc.onnegotiationneeded = function (e) {
		trace("+++++++++++ Solicitud de negociasion sdp ++++++++++++++++++");
	};

	if (localStream) {
		var videoTracks = localStream.getVideoTracks();
		var audioTracks = localStream.getAudioTracks();
		if (videoTracks.length > 0) {
			trace('Using video device: ' + videoTracks[0].label);
		}
		if (audioTracks.length > 0) {
			trace('Using audio device: ' + audioTracks[0].label);
		}

		if (localStream)
			addStreamToPC(localStream, pc);
		//pc.addStream(localStream);
		trace('Agregando local stream a PeerConnection');

	}

	pc.ontrack = gotRemoteStream;
	//pc.onaddstream = gotRemoteStream;


}

function onCreateSessionDescriptionError(error) {
	trace('Fallo al crear session description: ' + error.toString());
}

function onCreateOfferSuccess(desc, par) {
	trace('setLocalDescription start\n' + desc.sdp);
	par.pc.setLocalDescription(desc).then(
		function () {
			onSetLocalSuccess(par.pc);
		},
		onSetSessionDescriptionError
	);
	trace('Enviando Oferta');
	var dato = {};
	dato["nombre"] = participanteDifundido;
	dato["desc"] = desc;
	var msg = new SignalMsg(propietario, par.nombre, "Offer", dato, sala);
	enviarMsg(msg);

}

function onSetLocalSuccess(pc) {
	trace('setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
	trace('setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
	trace('Failed to set session description: ' + error.toString());
}

// function gotRemoteStream(e,participante) {
// 	if(!participante)
// 	{
// 		remoteVideo.srcObject = e.stream;
// 		trace('Recivido stream remoto');


// 	}else
// 	{
// 		participante.stream=e.stream;
// 		participante.video.srcObject=e.stream;
// 		trace('Recivido stream remoto de '+participante.nombre);
// 	}

// }


function gotRemoteStream(e, participante) {
	if (e.streams && e.streams[0])
		if (!participante) {
			trace('Recivido track remoto');
			remoteVideo.srcObject = e.streams[0];
			trace('Recivido stream remoto');


		} else {
			participante.streamReceiver = e.streams[0];
			//Verificamos que el participante no sea supervisor
			if (participante.video)
				participante.video.srcObject = e.streams[0];
			trace('Recivido stream remoto de ' + participante.nombre);

			if (e.streams[0].getAudioTracks()[0] && mezcla)
				mixAudioTrack(participante);

		}
	else
		trace("Stream recivido null");

}

function mixAudioTrack(participante) {
	hashParticipantes.forEach(function (v, k, map) {
		//Agrego el audioTrack del participante a los demas
		if (v.nombre !== participante.nombre) {
			let mediaStream = new MediaStream();
			mediaStream.addTrack(participante.streamReceiver.getAudioTracks()[0])
			let mediaStreamSource = new MediaStreamAudioSourceNode(ac1, { mediaStream: mediaStream });
			mediaStreamSource.connect(v.mediaStreamDestination);

		} else //Agrego los audioTracks de los demas al participante
			hashParticipantes.forEach(function (v1, k1, map) {
				if (v1.nombre !== participante.nombre) {
					let mediaStream = new MediaStream();
					mediaStream.addTrack(v1.streamReceiver.getAudioTracks()[0])
					let mediaStreamSource = new MediaStreamAudioSourceNode(ac1, { mediaStream: mediaStream });
					mediaStreamSource.connect(participante.mediaStreamDestination);
				}
			});
	});
}

function onCreateAnswerSuccess(desc) {
	trace('Creando respuesta');
	trace('setLocalDescription sdp:\n' + desc.sdp);
	pc.setLocalDescription(desc).then(
		function () {
			onSetLocalSuccess(pc);
		},
		onSetSessionDescriptionError
	);
	trace('Enviando respuesta sdp a propietario: ' + propietario);
	var msg = new SignalMsg(usuarioActual, propietario, "Answer", desc, sala);
	enviarMsg(msg);

	//Cambiando estado
	estado = "SendAnswer";
}

function onIceCandidate(event, participante) {
	var isUDP = null;

	//if(event.candidate)
	//{
	//	var tmp=event.candidate.candidate.match(" host ");
	//	if(tmp)
	//		isUDP=event.candidate.candidate.match(" udp ");
	//}


	if (!isUDP) {

		trace("Enviando IceCandidate:");
		/* if (event.candidate) {
			trace(event.candidate.candidate);
		} else
			trace(event.candidate); */
		var msg = null;
		if (!participante)
			msg = new SignalMsg(usuarioActual, propietario, "IceCandidate", event.candidate, sala);
		else
			msg = new SignalMsg(propietario, participante.nombre, "IceCandidate", event.candidate, sala);

		enviarMsg(msg);
	} else {
		trace("IceCandidate descartado:\n" + event.candidate.candidate);
	}

}

function onAddIceCandidateSuccess() {
	trace('addIceCandidate success');
}

function onAddIceCandidateError(error) {
	trace('failed to add ICE Candidate: ' + error.toString());
}


function onNegotiationNeeded(event, participante) {

	trace("+++++++++++ Solicitud de negociasion sdp ++++++++++++++++++");

}

function onConnectionStateChange(event, participante) {


	if (!participante) {
		trace('-------------------------  RTCPeerConnectionState: ' + pc.connectionState);
		switch (pc.connectionState) {
			case "closed":
			case "failed":
			case "disconnected":
				hangUp(undefined, "Fallo en la conexion RTCPeerConnectionState:" + pc.connectionState);
				break;
		}

	} else {
		var part = hashParticipantes.get(participante);
		if (part) {
			var pcPart = part.pc;
			trace('--------Participante: ' + participante + ' PeerIceState: ' + pcPart.connectionState);

			switch (pcPart.connectionState) {
				case "closed":
				case "failed":
				case "disconnected":
					hangUp(participante, "Fallo en la conexion RTCPeerConnectionState:" + pcPart.connectionState);
					break;
			}
		}

	}
}

function onIceStateChange(event, participante) {

}

function sendRestartIceOffer() {
	trace('Enviando solicitud IceRestart');
	var msg = new SignalMsg(usuarioActual, usuarioDestino, "RestartIce", null);
	enviarMsg(msg);
}

function restartIceOffer() {
	trace('Creando IceRestart Oferta');
	pc.createOffer({ offerToReceiveAudio: 1, offerToReceiveVideo: 1, iceRestart: true }).then(
		onCreateOfferSuccess,
		onCreateSessionDescriptionError
	);

}


function requestHangUp() {
	if (pc) {
		hangUp();
	} else {
		//hashParticipantes.forEach(function (v, k, map) {
		//	var msg = new SignalMsg(propietario, k, "HangUp", "Sala cerrada", sala);
		//	enviarMsg(msg);
		//});

		location.reload();
	}

}

function hangUp(participante, dato) {

	//si es un participante recargar la pagina
	if (pc) {
		if (dato)
			alert(dato)
		location.reload();
	}
	else if (participante) {
		var part = hashParticipantes.get(participante);

		try {
			if (part) {
				if (part.streamReceiver == broadcastStream)
					recuperarFuente();
				trace("Eliminando video participante: " + participante);
				if (part.mediaStreamSource)
					part.mediaStreamSource.disconnect();
				part.limpiar();
				part.pc.close();
				part.pc = null;

				let msg = new SignalMsg(propietario, participante, "HangUp", dato, sala);
				enviarMsg(msg);
				hashParticipantes.delete(participante);
			}

		}
		catch (exp) {
			trace(exp);
		}
	}
}

function enviarHangUp(mensaje) {
	if (pc) {
		try {
			pc.close();
		}
		catch (exp) {
			trace(exp);
		}
		alert(mensaje)
		location.reload();

	} else {


	}
}

function disableAudio(msg) {
	//Si es un participante
	console.log("DisableAudio:" + msg.dato)
	if (pc) {
		if (localStream && localStream.getAudioTracks().length > 0 && localStream.getAudioTracks()[0] && localStream.getAudioTracks()[0].enabled != msg.dato) {
			toggleMute(true)
		}
	}
	else if (hashParticipantes.get(msg.srcUser)) {
		hashParticipantes.get(msg.srcUser).video.muted = msg.dato

		if (msg.dato)
			hashParticipantes.get(msg.srcUser).buttonMuted.className = "icofont-volume-mute partButtonMute partButtonMuteEnable"
		else
			hashParticipantes.get(msg.srcUser).buttonMuted.className = "icofont-volume-mute partButtonMute"


	}
}

function disableVideo(dato) {
	//Si es un participante
	console.log("DisableVideo:" + dato)
	if (pc) {
		if (localStream && localStream.getVideoTracks().length > 0 && localStream.getVideoTracks()[0]) {
			localStream.getVideoTracks()[0].enabled = !dato
		}
	}
}

function mensajeDesconocido(msg) {
	trace("---------------------- No se pudo procesar mensaje.----------------------:\n");
	trace(msg);

}

//function addStreamToPC(stream,temPC)
//{
//	temPC.addStream(stream);
//}
function createRTCPeerConnection() {
	if (chromePlanB) {
		trace("Creando PeerConnection unified-plan para chrome v65-71");
		return new RTCPeerConnection({ iceServers: iceServers, sdpSemantics: 'unified-plan' });
	}
	trace("Creando PeerConnection");
	return new RTCPeerConnection({ iceServers: iceServers });
}


function addStreamToParticipante(stream, part) {
	addStreamToPC(stream, part.pc);
	part.streamSender = stream;
}

function addStreamToPC(stream, tempPC) {
	stream.getTracks().forEach(function (track) {
		tempPC.addTrack(track, stream);
	});
}

function addVideoTrackToParticipante(videoTrack, part) {

	if (videoTrack) {
		part.streamSender.addTrack(videoTrack);
		part.pc.addTrack(videoTrack, part.streamSender);
	}

}

function removeVideoTrackOfParticipante(part) {
	if (part.streamSender.getVideoTracks().length > 0) {
		trace("Removiendo VideoTrack de participante: " + part.nombre);
		part.streamSender.removeTrack(part.streamSender.getVideoTracks()[0]);
	}
	part.pc.getSenders().forEach(function (sender) {
		if (sender.track && sender.track.kind === "Video") {
			trace("Removiendo VideoTrack " + sender);
			part.pc.removeTrack(sender);
		}

	});

}

// logging utility
function trace(arg) {
	if (debug == true) {
		var now = (window.performance.now() / 1000).toFixed(3);
		console.log(now + ': ', arg);
	}

}


function getBrowserInfo() {
	var ua = navigator.userAgent, tem,
		M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
	if (/trident/i.test(M[1])) {
		tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
		return 'IE ' + (tem[1] || '');
	}
	if (M[1] === 'Chrome') {
		tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
		if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
	}
	M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
	//if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
	return M.join(' ');
};
