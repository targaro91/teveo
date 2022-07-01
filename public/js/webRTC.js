
'use strict';

//var socket = io.connect('https://alical.alimaticgr.alinet.cu:443');
var socket = io();

// Online,SendOffer,SendAnswer,Ocupado
var estado="Online";
var usuarioDestino=null;
var usuarioActual=null;
//Remitente, Destinatario
var peerType=null;

var callButton = document.getElementById('callButton');
var hangupButton = document.getElementById('hangupButton');
var registerButton = document.getElementById('registerButton');

callButton.disabled = false;
hangupButton.disabled = true;
callButton.onclick = iniciarLLamada;
hangupButton.onclick = hangup;
registerButton.onclick = autentificar;

var startTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var localStream=null;

//RTCPeerConnection
var pc;

//var ws = new WebSocket("ws://192.168.87.155:8080");
var ws=null;
var iceConfiguration={ iceServers: [{
                          urls: "turn:192.168.87.155:3478?transport=tcp",
                          username: "david",
                          credential: "234"
                      }]
};


var SignalMsg= function (srcUser,dstUser,tipo,dato)
{	this.srcUser=srcUser;
	this.dstUser=dstUser;	
	this.tipo=tipo;// Invite,Offer,Answer,IceCandidate,HangUp,Error,AnswerInvite,Decline
	this.dato=dato;
};


//ws.onmessage = function (event) {
//  console.log("Mensage recivido");
//  console.log(event.data);
//  procesarMsg(toObject(event.data));
//}

socket.on('message', function(data) {
	console.log("Mensage recivido");
	console.log(data);
	procesarMsg(toObject(data));
});

function enviarMsg(msg)
{
	socket.emit('new-message', toJSON(msg));
	
}
function procesarMsg(signalMsg)
{		
	switch(signalMsg.tipo)
	{
		case "RestartIce": 
			restartIceOffer();
			break;
		case "AnswerInvite":
			if(signalMsg.dato="Accept")
			{
				peerType="Remitente";
				call();
				estado="Online";
			}else
			{
				setOnline();
				alert(signalMsg.dato);
			}		
			break;
		case "Invite":
			if(estado!="Ocupado")
			{
				estado="Ocupado";
				peerType="Destinatario";
			    usuarioDestino=signalMsg.srcUser;
			    start(acceptCall);
			}else
			{
				var msg=new SignalMsg(usuarioActual,usuarioDestino,"AnswerInvite",estado);
				enviarMsg(msg);	
			}
					
			break;
		case "Offer": 
			hangupButton.disabled = false;
			procesarOferta(signalMsg);
			break;		
		case "Answer":
			procesarRespuesta(signalMsg);
			break;
		case "HangUp":
			trace("Recivida solicitud de hangUp.");
			hangup(true);
			break;
		case "Error":
			alert("Error :"+signalMsg.dato);
			setOnline();
			break;
		case "IceCandidate":
			agregarIceCandidate(signalMsg.dato); 
			break;				
		default : {mensajeDesconocido(signalMsg);break;}
		
	}	
	
}

function autentificar()
{
	usuarioActual=document.getElementById('inputUsuarioLocal').value;
	
	trace('Enviando autentifacion');
	var msg=new Object();
	msg.tipo="Autenticate"
	
	var login=new Object();
	login.user=usuarioActual;
	msg.dato=login;
	
	enviarMsg(msg);
	
}

function agregarIceCandidate(candidate)
{
	trace("Agregando IceCandidate: \n");
	trace(candidate);
	pc.addIceCandidate(candidate).then(function() {onAddIceCandidateSuccess();},function(err) {onAddIceCandidateError(err);});
	if(candidate)
		trace('ICE candidate: \n' + (event.candidate ? event.candidate.candidate : '(null)'));
	else
		trace('ICE candidate: null\n');
		
}

function procesarRespuesta(signalMsg)
{
	trace('setRemoteDescription start sdp:\n'+signalMsg.dato.sdp);
	pc.setRemoteDescription(signalMsg.dato).then(function() {onSetRemoteSuccess(pc);}, onSetSessionDescriptionError );
}


function onconnectionstatechange(event) {
  switch(pc.connectionState) {
    case "disconnected":
    case "failed":
	case "closed":
      Trace("PeerConnectionState: "+ pc.connectionState);
	  setOnline();
      break;
  }
}

function procesarOferta(signalMsg)
{
	trace("Oferta recivida.");
	var desc=signalMsg.dato;	
	
	
	trace('setRemoteDescription start sdp:\n'+desc.sdp);
	pc.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(pc);
    },
    onSetSessionDescriptionError
	);
	
	pc.createAnswer().then(
    onCreateAnswerSuccess,
    onCreateSessionDescriptionError
  );	
	
}

function crearOferta()
{
	trace('Creando Oferta');
  pc.createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );	
}

function toJSON(object)
{
 return JSON.stringify(object);
}

function toObject(json)
{
 return JSON.parse(json);
}


localVideo.addEventListener('loadedmetadata', function() {
  trace('Local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.addEventListener('loadedmetadata', function() {
  trace('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.onresize = function() {
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

localVideo.onresize = function() {
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



var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};


function gotStream(stream) {
  trace('Reciviendo local stream');
  localVideo.srcObject = stream;
  localStream = stream;
}

function start(varfunction) {
  trace('Solicitud local stream');
  callButton.disabled = true;
  
  var constraints = {
  audio: true,
  video: {
    width: { min: 256, ideal: 256, max: 320 },
    height: { min: 144, ideal: 144, max: 240 }
  }
};
  
  //constraints={ audio: true,   video: true};
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then(varfunction)
    .catch(function(e) {
      trace('getUserMedia() error: ' + e.name);
	  varfunction();
    });
}

function iniciarLLamada()
{
	usuarioDestino=document.getElementById('inputUsuarioRemoto').value;
	if(estado=="Online")
	{
		estado="Ocupado";
		start(requestCall);	
	}
		
}
function requestCall(stream)
{
	if(usuarioActual&&usuarioDestino)
	{
		gotStream(stream);
		trace("Solicitud de llamada a"+usuarioDestino);
		trace('Enviando Solicitud de llamada');
		var msg=new SignalMsg(usuarioActual,usuarioDestino,"Invite",null);
		enviarMsg(msg);		
		estado="Invite";
	}
		
}

function acceptCall(stream=null)
{
	var iceConf={ iceServers: [{
                          urls: "turn:192.168.87.155:3478?transport=tcp",
                          username: "david",
                          credential: "234"
                      }]
					  };
	pc = new RTCPeerConnection(iceConf);
	pc.onicecandidate = function(e) {onIceCandidate(e);};
	pc.oniceconnectionstatechange = function(e) {onIceStateChange(e);};
	pc.onaddstream = gotRemoteStream;
	//pc.onconnectionstatechange=onconnectionstatechange;
	
	if(stream)
	{
		gotStream(stream);
		pc.addStream(localStream);
	}
	
	trace('Added local stream to PeerConnection');
	
	var msg=new SignalMsg(usuarioActual,usuarioDestino,"AnswerInvite","Accept");
	enviarMsg(msg);
}
function call() {
	
  trace("Llamando a "+usuarioDestino);
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace('Starting call');
  startTime = window.performance.now();
  var videoTracks = localStream.getVideoTracks();
  var audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  var iceConf={ iceServers: [{
                          urls: "turn:192.168.87.155:3478?transport=tcp",
                          username: "david",
                          credential: "234"
                      }]
					  };
  pc = new RTCPeerConnection(iceConf);
  trace('Created local peer connection');
  
  pc.onicecandidate = function(e) {
    onIceCandidate(e);
  };
  //pc.onconnectionstatechange=onconnectionstatechange;
  pc.oniceconnectionstatechange = function(e) {
    onIceStateChange(e);
  };
  pc.onnegotiationneeded=function(e) {
    trace("+++++++++++ Solicitud de negociasion sdp ++++++++++++++++++");
  };

  pc.addStream(localStream);
  trace('Added local stream to PeerConnection');
  
  pc.onaddstream = gotRemoteStream;
  
  trace('Enviando oferta');
  crearOferta();

  
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  trace('setLocalDescription start\n' + desc.sdp);
  pc.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc);
    },
    onSetSessionDescriptionError
  );
  trace('Enviando Oferta');
  var msg=new SignalMsg(usuarioActual,usuarioDestino,"Offer",desc);
  enviarMsg(msg);
  
  //Cambiando estado
  estado="SendOffer";
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

function gotRemoteStream(e) {
  remoteVideo.srcObject = e.stream;
  trace('Recivido stream remoto');
}

function onCreateAnswerSuccess(desc) {
  trace('Creando respuesta');
  trace('setLocalDescription sdp:\n' + desc.sdp);
  pc.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc);
    },
    onSetSessionDescriptionError
  );
  trace('Enviando respuesta sdp');
  var msg=new SignalMsg(usuarioActual,usuarioDestino,"Answer",desc);
  enviarMsg(msg);
  //Cambiando estado
  estado="SendAnswer";
}

function onIceCandidate(event) {
  	
  trace("Enviando IceCandidate:"+event);
  if (event.candidate) {
    trace(event.candidate);
  }
  var msg=new SignalMsg(usuarioActual,usuarioDestino,"IceCandidate",event.candidate);
  enviarMsg(msg);
}

function onAddIceCandidateSuccess() {
  trace('addIceCandidate success');
}

function onAddIceCandidateError(error) {
  trace('failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(event) {
	if(pc)
	{
		trace('-------------------------  PeerIceState: ' + pc.iceConnectionState);
		switch(pc.iceConnectionState) 
		{
			case "closed":
			case "failed":
				setOnline();
				break;
		}
		
	}
		
	else
		trace("PC is null");
    
}

function sendRestartIceOffer()
{
	trace('Enviando solicitud IceRestart');
	var msg=new SignalMsg(usuarioActual,usuarioDestino,"RestartIce",null);
    enviarMsg(msg);
}

function restartIceOffer()
{
  trace('Creando IceRestart Oferta');
  pc.createOffer({offerToReceiveAudio: 1,offerToReceiveVideo: 1,iceRestart: true}).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
		
}


function setOnline()
{
	try{
		pc.close();
	}catch(exp){}
	pc = null;
	estado="Online";
	hangupButton.disabled = true;
	callButton.disabled = false;
	alert("Llamada terminada");
}

function hangup() {
  setOnline();
}


function mensajeDesconocido(msg)
{
	trace("---------------------- No se pudo procesar mensaje.----------------------:\n");
	trace(msg);
	
}

// logging utility
function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ': ', arg);
}
