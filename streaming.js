// map peer usernames to corresponding RTCPeerConnections
// as key value pairs
var mapPeers = {};

// peers that stream own screen
// to remote peers
var mapScreenPeers = {};

// true if screen is being shared
// false otherwise
var screenShared = false;

const localVideo = document.querySelector('#local-video');

// button to start or stop screen sharing
var btnShareScreen = document.querySelector('#btn-share-screen');

// local video stream
var localStream = new MediaStream();

// local screen stream
// for screen sharing
var localDisplayStream = new MediaStream();

// buttons to toggle self audio and video
btnToggleAudio = document.querySelector("#btn-toggle-audio");
btnToggleVideo = document.querySelector("#btn-toggle-video");

var messageInput = document.querySelector('#msg');
var btnSendMsg = document.querySelector('#btn-send-msg');

// button to start or stop screen recording
var btnRecordScreen = document.querySelector('#btn-record-screen');
// object that will start or stop screen recording
var recorder;
// true of currently recording, false otherwise
var recording = false;

var file;

var btnViewerJoin = document.querySelector("#btn-viewer-join");
var btnStart = document.querySelector('#btn-start');



// ul of messages
var ul = document.querySelector("#message-list");

var loc = window.location;

var endPoint = '';
var wsStart = 'ws://';

if(loc.protocol == 'https:'){
    wsStart = 'wss://';
}
var host =  window.location.host;
var host = "192.168.43.247:8001";
var host = "127.0.0.1:8001";
var endPoint = wsStart + host + "/ws/live-room/";
console.log("endPoint"+endPoint);
endPoint='wss://mango-live.website/ws/live-room/'
var webSocket;

var usernameInput = document.querySelector('#username');
var username;
//改這：存取user type
var userType = document.querySelector('#user-type');
var btnJoin = document.querySelector('#btn-join');
var currentUserId;//改這：fetch user id (user login)
var roomId = 9;//改這：fetch room id
var streaming = false;

btnJoin.onclick = () => {
    username = usernameInput.value;

    if(username == ''){
        // ignore if username is empty
        return;
    }


    document.querySelector('#label-username').innerHTML = username;

    webSocket = new WebSocket(endPoint);
    console.log("websocket endPoint ",endPoint);

    webSocket.onopen = function(e){
        console.log('Connection opened! ', e);

        //改這：從user_type
        var type = "viewer_join_room";
        currentUserId=2;
        var destUserId=1;

        if (userType.value=="streamer"){
            type="streamer_join_room";
            currentUserId= 1;
            destUserId=null;
        }

        console.log("websocket type",type);

        // notify other peers
        sendSignal(type, {
            'local_screen_sharing': false,
            "room_id":roomId, //TODO: fixme
            "dest_user_id":destUserId, //TODO: fixme
            "src_user_id":currentUserId //TODO: fixme
        });
    }
    webSocket.onmessage = webSocketOnMessage;


    webSocket.onclose = function(e){
        console.log('Connection closed! ', e);
        return;
    }

    webSocket.onerror = function(e){
        console.log('Error occured! ', e);

        btnSendMsg.disabled = true;
        messageInput.disabled = true;

        // clear input
        usernameInput.value = '';
        // disable and vanish input
        btnJoin.disabled = false;
        usernameInput.style.visibility = 'visible';
        // disable and vanish join button
        btnJoin.disabled = false;
        btnJoin.style.visibility = 'visible';
        return;
    }

    btnSendMsg.disabled = false;
    messageInput.disabled = false;

    // clear input
    usernameInput.value = '';
    // disable and vanish input
    btnJoin.disabled = true;
    usernameInput.style.visibility = 'hidden';
    // disable and vanish join button
    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';
}

function webSocketOnMessage(event){
    var parsedData = JSON.parse(event.data)["data"];

    console.log("parsedData ",parsedData)
    var action = parsedData['action'];
    var src_user_id = parsedData['src_user_id'];
    var dest_user_id = parsedData['dest_user_id'];
    var parsedRoomId = parsedData['room_id'];


    console.log('src_user_id: ', src_user_id);
    console.log('dest_user_id: ', dest_user_id);
    console.log('currentUserId: ', currentUserId);
    console.log('parsedRoomId: ', parsedRoomId);
    console.log('action: ', action);

    // boolean value specified by other peer
    // indicates whether the other peer is sharing screen
    // var remoteScreenSharing = parsedData['message']['local_screen_sharing'];
    // console.log('remoteScreenSharing: ', remoteScreenSharing);
    var remoteScreenSharing =parsedData['local_screen_sharing'];

    if (parsedRoomId!=roomId){
        return;
    }

    try{
        console.log("here")
        if(parsedData["success"]==false && currentUserId==dest_user_id){
            throw new Error(parsedData["message"])
        }
    }
    catch(e){
        alert("websocket onmessage error : "+e)
        if(action=="viewer_join_room"){
            webSocket.dispatchEvent(new Event('error', { error: e }));
        }
        return;
    }

    // channel name of the sender of this message
    // used to send messages back to that sender
    // hence, receiver_channel_name
    var receiver_channel_name = parsedData['receiver_channel_name'];
    console.log('receiver_channel_name: ', receiver_channel_name);

    if(action=="streamer_share_screen" ){
        if(currentUserId==src_user_id){
            console.log("current user is the streamer, skip sharing screen");

        }
        else{
            message = parsedData["message"];
            if(message){
                console.log("streamer_share_screen error : ",message);
            }
            else{
                console.log("streamer_share_screen src : ",currentUserId);
                console.log("streamer_share_screen dest : ",src_user_id);
                createOfferer(src_user_id,currentUserId,  false,true, receiver_channel_name);
            }
        }
        return
    }

    if(dest_user_id && dest_user_id!=currentUserId){
        console.log("current user id :",currentUserId);
        console.log("dest user id :",dest_user_id);
        // ignore all messages from oneself
        return;
    }

    // in case of new peer
    if(action == 'viewer_join_room'){
        console.log('New peer: ', src_user_id);

        // create new RTCPeerConnection
        createOfferer(src_user_id,dest_user_id, false, remoteScreenSharing, receiver_channel_name);

        if(screenShared && !remoteScreenSharing){
            // if local screen is being shared
            // and remote peer is not sharing screen
            // send offer from screen sharing peer
            console.log('Creating screen sharing offer.');
            createOfferer(src_user_id,dest_user_id, false, remoteScreenSharing, receiver_channel_name);
        }

        return;
    }

    // remote_screen_sharing from the remote peer
    // will be local screen sharing info for this peer
    var localScreenSharing = parsedData['remote_screen_sharing'];

    if(action == 'new-offer'){
        console.log('Got new offer from ', src_user_id);

        // create new RTCPeerConnection
        // set offer as remote description
        var offer = parsedData['sdp'];
        console.log('Offer: ', offer);
        var peer = createAnswerer(offer, src_user_id,dest_user_id, localScreenSharing, remoteScreenSharing, receiver_channel_name);

        return;
    }


    if(action == 'new-answer'){
        console.log("new-answers mapPeers ",mapPeers)
        // in case of answer to previous offer
        // get the corresponding RTCPeerConnection
        var peer = null;

        if(remoteScreenSharing){
            // if answerer is screen sharer
            peer = mapPeers[src_user_id + ' Screen'][0];
        }else if(localScreenSharing){
            // if offerer was screen sharer
            peer = mapScreenPeers[src_user_id][0];
        }else{
            // if both are non-screen sharers
            peer = mapPeers[src_user_id][0];
        }

        // get the answer
        var answer = parsedData['sdp'];

        console.log('mapPeers:');
        for(key in mapPeers){
            console.log(key, ': ', mapPeers[key]);
        }

        console.log('peer: ', peer);
        console.log('answer: ', answer);

        // set remote description of the RTCPeerConnection
        peer.setRemoteDescription(answer);

        return;
    }

    if(action=="chat"){
        if(currentUserId==src_user_id){
            return;
        }
        var nodeText=parsedData["username"]+": "+parsedData["message"]
        appendMessage(nodeText)
    }

}

messageInput.addEventListener('keyup', function(event){
    if(event.keyCode == 13){
        // prevent from putting 'Enter' as input
        event.preventDefault();

        // click send message button
        btnSendMsg.click();
    }
});

btnSendMsg.onclick = btnSendMsgOnClick;

function appendMessage(nodeText){
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(nodeText));
    ul.appendChild(li);
}
function btnSendMsgOnClick(){

    console.log('Sending: ', message);
    var message = messageInput.value;

    // send to all data channels
    // for(index in dataChannels){
    //     dataChannels[index].send(username + ': ' + message);
    // }

    // send offer to new peer
    // after ice candidate gathering is complete
    sendSignal('chat', {
        "room_id":roomId,
        "src_user_id":currentUserId,
        "message":message,
    });

    var nodeText = "Me: " + message;
    appendMessage(nodeText)

    messageInput.value = '';
}

const constraints = {
    'video': true,
    'audio': true
}

// const iceConfiguration = {
//     iceServers: [
//         {
//             urls: ['turn:numb.viagenie.ca'],
//             credential: numbTurnCredential,
//             username: numbTurnUsername
//         }
//     ]
// };

userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        console.log('Got MediaStream:', stream);
        var mediaTracks = stream.getTracks();

        for(i=0; i < mediaTracks.length; i++){
            console.log(mediaTracks[i]);
        }

        localVideo.srcObject = localStream;
        localVideo.muted = true;

        window.stream = stream; // make variable available to browser console

        audioTracks = stream.getAudioTracks();
        videoTracks = stream.getVideoTracks();
        console.log("audiotracks : ",audioTracks);
        console.log("videoTracks : ",videoTracks);
        // unmute audio and video by default
        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.onclick = function(){
            audioTracks[0].enabled = !audioTracks[0].enabled;
            if(audioTracks[0].enabled){
                btnToggleAudio.innerHTML = 'Audio Mute';
                return;
            }

            btnToggleAudio.innerHTML = 'Audio Unmute';
        };

        btnToggleVideo.onclick = function(){
            videoTracks[0].enabled = !videoTracks[0].enabled;
            if(videoTracks[0].enabled){
                btnToggleVideo.innerHTML = 'Video Off';
                return;
            }

            btnToggleVideo.innerHTML = 'Video On';
        };
    }).then(e =>{
        if (btnViewerJoin){
            btnViewerJoin.onclick = event => {

                var btnJoinStatus= "Join streaming";
                var event_type = "viewer_leave";
                // toggle streaming

                console.log("viewerJoin ",viewerJoin)
                viewerJoin = !viewerJoin;
                if (viewerJoin){
                    btnJoinStatus= "Leave streaming";
                    event_type = "viewer_join_room";
                }
                console.log("event_type ",event_type)
                sendSignal(event_type, {
                    'local_screen_sharing': false,
                    "room_id":roomId,
                    "src_user_id":currentUserId,
                });
                btnViewerJoin.innerHTML = btnJoinStatus;
            }
        }

    })
    .then(e => {
        btnStart.onclick = event => {

            var btnStartStatus= "Start streaming";
            var event_type = "streamer_stop";
            // toggle streaming

            console.log("streaming ",streaming)
            streaming = !streaming;
            if (streaming){
                btnStartStatus= "Stop streaming";
                event_type = "streamer_start";
            }
            console.log("event_type ",event_type)
            sendSignal(event_type, {
                'local_screen_sharing': false,
                "room_id":roomId
            });
            btnStart.innerHTML = btnStartStatus;
            console.log("after streaming ",streaming)
            console.log("btnStartStatus ",btnStartStatus)
        }
    })
    .then(e => {
        btnShareScreen.onclick = event => {
            if(screenShared){
                // toggle screenShared
                screenShared = !screenShared;

                // set to own video
                // if screen already shared
                localVideo.srcObject = localStream;
                btnShareScreen.innerHTML = 'Share screen';

                // get screen sharing video element
                var localScreen = document.querySelector('#my-screen-video');
                // remove it
                removeVideo(localScreen);

                // close all screen share peer connections
                var screenPeers = getPeers(mapScreenPeers);
                for(index in screenPeers){
                    screenPeers[index].close();
                }
                // empty the screen sharing peer storage object
                mapScreenPeers = {};

                return;
            }

            // toggle screenShared
            screenShared = !screenShared;

            navigator.mediaDevices.getDisplayMedia(constraints)
                .then(stream => {
                    localDisplayStream = stream;

                    var mediaTracks = stream.getTracks();
                    for(i=0; i < mediaTracks.length; i++){
                        console.log(mediaTracks[i]);
                    }

                    // var localScreen = createVideo('my-screen');
                    // // set to display stream
                    // // if screen not shared
                    // localScreen.srcObject = localDisplayStream;

                    // notify other peers
                    // of screen sharing peer
                    sendSignal('streamer_share_screen', {
                        'local_screen_sharing': true,
                        "room_id":roomId,
                        "src_user_id":currentUserId,
                    });
                })
                .catch(error => {
                    console.log('Error accessing display media.', error);
                });

            btnShareScreen.innerHTML = 'Stop sharing';
        }
    })
    // .then(e => {
    //     btnRecordScreen.addEventListener('click', () => {
    //         if(recording){
    //             // toggle recording
    //             recording = !recording;

    //             btnRecordScreen.innerHTML = 'Record Screen';

    //             recorder.stopRecording(function() {
    //                 var blob = recorder.getBlob();
    //                 invokeSaveAsDialog(blob);
    //             });

    //             return;
    //         }

    //         // toggle recording
    //         recording = !recording;

    //         navigator.mediaDevices.getDisplayMedia(constraints)
    //             .then(stream => {
    //                 recorder = RecordRTC(stream, {
    //                     type: 'video',
    //                     MimeType: 'video/mp4'
    //                 });
    //                 recorder.startRecording();

    //                 var mediaTracks = stream.getTracks();
    //                 for(i=0; i < mediaTracks.length; i++){
    //                     console.log(mediaTracks[i]);
    //                 }

    //             })
    //             .catch(error => {
    //                 console.log('Error accessing display media.', error);
    //             });

    //         btnRecordScreen.innerHTML = 'Stop Recording';
    //     });
    // })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

// send the given action and data
// over the websocket connection
function sendSignal(action, data){
    console.log(action,data);
    webSocket.send(
        JSON.stringify(
            {
                'action': action,
                'data': data,
            }
        )
    )
}

// create RTCPeerConnection as offerer
// and store it and its datachannel
// send sdp to remote peer after gathering is complete
function createOfferer(srcPeerUserId,destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name){
    var peer = new RTCPeerConnection({
        iceServers:[
            {
            urls: 'stun:stun.l.google.com:19302',
          },
          {
            urls: 'stun:stun1.l.google.com:19302',
          },
          {
            urls: 'stun:stun2.l.google.com:19302',
          },
        ]
    });

    // add local user media stream tracks
    addLocalTracks(peer, localScreenSharing);

    // create and manage an RTCDataChannel
    var dc = peer.createDataChannel("channel");
    dc.onopen = () => {
        console.log("Connection opened.");
    };
    if(!localScreenSharing && !remoteScreenSharing){
        // none of the peers are sharing screen (normal operation)

        dc.onmessage = dcOnMessage;


        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        mapPeers[srcPeerUserId] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            var iceConnectionState = peer.iceConnectionState;
            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                console.log('Deleting peer');
                delete mapPeers[srcPeerUserId];
                if(iceConnectionState != 'closed'){
                    peer.close();
                }
                // removeVideo(remoteVideo);
            }
        };
    }else if(!localScreenSharing && remoteScreenSharing){
        // answerer is screen sharing

        dc.onmessage = (e) => {
            console.log('New message from %s\'s screen: ', srcPeerUserId, e.data);
        };

        // remoteVideo = createVideo(srcPeerUserId + '-screen');
        // setOnTrack(peer, remoteVideo);
        // console.log('Remote video source: ', remoteVideo.srcObject);

        // if offer is not for screen sharing peer
        mapPeers[srcPeerUserId + ' Screen'] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            var iceConnectionState = peer.iceConnectionState;
            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                delete mapPeers[peerUserId + ' Screen'];
                if(iceConnectionState != 'closed'){
                    peer.close();
                }
                // removeVideo(remoteVideo);
            }
        };
    }else{
        // offerer itself is sharing screen

        dc.onmessage = (e) => {
            console.log('New message from %s: ', srcPeerUserId, e.data);
        };

        mapScreenPeers[srcPeerUserId] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            var iceConnectionState = peer.iceConnectionState;
            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                delete mapScreenPeers[srcPeerUserId];
                if(iceConnectionState != 'closed'){
                    peer.close();
                }
            }
        };
    }

    peer.onicecandidate = (event) => {
        if(event.candidate){
            return;
        }

        // event.candidate == null indicates that gathering is complete

        console.log('Gathering finished! Sending offer SDP to ', srcPeerUserId, '.');
        console.log('receiverChannelName: ', receiver_channel_name);

        // send offer to new peer
        // after ice candidate gathering is complete
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
            "room_id":roomId,
            "src_user_id":destPeerUserId,
            "dest_user_id":srcPeerUserId
        });
    }

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(function(event){
            console.log("Local Description Set successfully.");
        });

    console.log('mapPeers[', srcPeerUserId, ']: ', mapPeers[srcPeerUserId]);

    return peer;
}

// create RTCPeerConnection as answerer
// and store it and its datachannel
// send sdp to remote peer after gathering is complete
function createAnswerer(offer, srcPeerUserId,destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name){
    var peer = new RTCPeerConnection({
        iceServers:[{"urls":"stun:stun.l.google.com:19302"}]
    });


    addLocalTracks(peer, localScreenSharing);
    console.log("localScreenSharing",localScreenSharing)
    console.log("remoteScreenSharing",remoteScreenSharing)
    if(!localScreenSharing && !remoteScreenSharing){
        // if none are sharing screens (normal operation)

        // set remote video
        var remoteVideo = createVideo(srcPeerUserId);

        // and add tracks to remote video
        setOnTrack(peer, remoteVideo);

        // it will have an RTCDataChannel
        peer.ondatachannel = e => {
            console.log('e.channel.label: ', e.channel.label);
            peer.dc = e.channel;
            peer.dc.onmessage = dcOnMessage;
            peer.dc.onopen = () => {
                console.log("Connection opened.");
            }

            // store the RTCPeerConnection
            // and the corresponding RTCDataChannel
            // after the RTCDataChannel is ready
            // otherwise, peer.dc may be undefined
            // as peer.ondatachannel would not be called yet
            mapPeers[srcPeerUserId] = [peer, peer.dc];
        }

        peer.oniceconnectionstatechange = () => {
            var iceConnectionState = peer.iceConnectionState;
            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                delete mapPeers[srcPeerUserId];
                if(iceConnectionState != 'closed'){
                    peer.close();
                }
                removeVideo(remoteVideo);
            }
        };
    }else if(localScreenSharing && !remoteScreenSharing){
        // answerer itself is sharing screen

        // it will have an RTCDataChannel
        peer.ondatachannel = e => {
            peer.dc = e.channel;
            peer.dc.onmessage = (evt) => {
                console.log('New message from %s: ', srcPeerUserId, evt.data);
            }
            peer.dc.onopen = () => {
                console.log("Connection opened.");
            }

            // this peer is a screen sharer
            // so its connections will be stored in mapScreenPeers
            // store the RTCPeerConnection
            // and the corresponding RTCDataChannel
            // after the RTCDataChannel is ready
            // otherwise, peer.dc may be undefined
            // as peer.ondatachannel would not be called yet
            mapScreenPeers[srcPeerUserId] = [peer, peer.dc];

            peer.oniceconnectionstatechange = () => {
                var iceConnectionState = peer.iceConnectionState;
                if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                    delete mapScreenPeers[srcPeerUserId];
                    if(iceConnectionState != 'closed'){
                        peer.close();
                    }
                }
            };
        }
    }else{
        // offerer is sharing screen

        // set remote video
        var remoteVideo = createVideo(srcPeerUserId + '-screen');
        // and add tracks to remote video
        setOnTrack(peer, remoteVideo);

        // it will have an RTCDataChannel
        peer.ondatachannel = e => {
            peer.dc = e.channel;
            peer.dc.onmessage = evt => {
                console.log('New message from %s\'s screen: ', srcPeerUserId, evt.data);
            }
            peer.dc.onopen = () => {
                console.log("Connection opened.");
            }

            // store the RTCPeerConnection
            // and the corresponding RTCDataChannel
            // after the RTCDataChannel is ready
            // otherwise, peer.dc may be undefined
            // as peer.ondatachannel would not be called yet
            mapPeers[srcPeerUserId + ' Screen'] = [peer, peer.dc];

        }
        peer.oniceconnectionstatechange = () => {
            var iceConnectionState = peer.iceConnectionState;
            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                delete mapPeers[srcPeerUserId + ' Screen'];
                if(iceConnectionState != 'closed'){
                    peer.close();
                }
                removeVideo(remoteVideo);
            }
        };
    }

    peer.onicecandidate = (event) => {
        if(event.candidate){
            return;
        }

        // event.candidate == null indicates that gathering is complete

        console.log('Gathering finished! Sending answer SDP to ', srcPeerUserId, '.');
        console.log('receiverChannelName: ', receiver_channel_name);

        // send answer to offering peer
        // after ice candidate gathering is complete
        // answer needs to send two types of screen sharing data
        // local and remote so that offerer can understand
        // to which RTCPeerConnection this answer belongs
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
            "room_id":roomId,
            "src_user_id":destPeerUserId,
            "dest_user_id":srcPeerUserId
        });
    }

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Set offer from %s.', srcPeerUserId);
            return peer.createAnswer();
        })
        .then(a => {
            console.log('Setting local answer for %s.', srcPeerUserId);
            return peer.setLocalDescription(a);
        })
        .then(() => {
            console.log('Answer created for %s.', srcPeerUserId);
            console.log('localDescription: ', peer.localDescription);
            console.log('remoteDescription: ', peer.remoteDescription);
        })
        .catch(error => {
            console.log('Error creating answer for %s.', srcPeerUserId);
            console.log(error);
        });

    return peer
}

function dcOnMessage(event){
    var message = event.data;

    var li = document.createElement("li");
    li.appendChild(document.createTextNode(message));
    ul.appendChild(li);
}

// get all stored data channels
function getDataChannels(){
    var dataChannels = [];

    for(peerUserId in mapPeers){
        console.log('mapPeers[', peerUserId, ']: ', mapPeers[peerUserId]);
        var dataChannel = mapPeers[peerUserId][1];
        console.log('dataChannel: ', dataChannel);

        dataChannels.push(dataChannel);
    }

    return dataChannels;
}

// get all stored RTCPeerConnections
// peerStorageObj is an object (either mapPeers or mapScreenPeers)
function getPeers(peerStorageObj){
    var peers = [];

    for(peerUserId in peerStorageObj){
        var peer = peerStorageObj[peerUserId][0];
        console.log('peer: ', peer);

        peers.push(peer);
    }

    return peers;
}

// for every new peer
// create a new video element
// and its corresponding user gesture button
// assign ids corresponding to the username of the remote peer
function createVideo(peerUserId){
    var videoContainer = document.querySelector('#video-container');

    // create the new video element
    // and corresponding user gesture button
    var remoteVideo = document.createElement('video');
    // var btnPlayRemoteVideo = document.createElement('button');

    remoteVideo.id = peerUserId + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;
    // btnPlayRemoteVideo.id = peerUserId + '-btn-play-remote-video';
    // btnPlayRemoteVideo.innerHTML = 'Click here if remote video does not play';

    // wrapper for the video and button elements
    var videoWrapper = document.createElement('div');

    // add the wrapper to the video container
    videoContainer.appendChild(videoWrapper);

    // add the video to the wrapper
    videoWrapper.appendChild(remoteVideo);
    // videoWrapper.appendChild(btnPlayRemoteVideo);

    // as user gesture
    // video is played by button press
    // otherwise, some browsers might block video
    // btnPlayRemoteVideo.addEventListener("click", function (){
    //     remoteVideo.play();
    //     btnPlayRemoteVideo.style.visibility = 'hidden';
    // });

    return remoteVideo;
}

// set onTrack for RTCPeerConnection
// to add remote tracks to remote stream
// to show video through corresponding remote video element
function setOnTrack(peer, remoteVideo){
    console.log('Setting ontrack:');
    // create new MediaStream for remote tracks
    var remoteStream = new MediaStream();

    // assign remoteStream as the source for remoteVideo
    remoteVideo.srcObject = remoteStream;

    console.log('remoteVideo: ', remoteVideo.id);

    peer.addEventListener('track', async (event) => {
        console.log('Adding track: ', event.track);
        remoteStream.addTrack(event.track, remoteStream);
    });
}

// called to add appropriate tracks
// to peer
function addLocalTracks(peer, localScreenSharing){
    if(!localScreenSharing){
        // if it is not a screen sharing peer
        // add user media tracks
        localStream.getTracks().forEach(track => {
            console.log('Adding localStream tracks.');
            peer.addTrack(track, localStream);
        });

        return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    localDisplayStream.getTracks().forEach(track => {
        console.log('Adding localDisplayStream tracks.');
        peer.addTrack(track, localDisplayStream);
    });
}

function removeVideo(video){
    // get the video wrapper
    var videoWrapper = video.parentNode;
    // remove it
    videoWrapper.parentNode.removeChild(videoWrapper);
}
