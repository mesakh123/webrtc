import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  TextInput,
  Platform,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Button,
  NativeEventEmitter,
  FlatList,
} from 'react-native';

import {
  RTCView,
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import styles from './AppStyles';
import RoundedButton from './RoundedButton';
import { Dropdown } from 'react-native-element-dropdown';
import AntDesign from 'react-native-vector-icons/AntDesign';


function Demo() {


  const userTypeData = [
    { label: 'streamer', value: 'streamer' },
    { label: 'viewer', value: 'viewer' },
  ];

  const ICESERVERS = [
    { url: 'stun:stun.l.google.com:19302' },
    { url: 'stun:stun01.sipphone.com' },
    { url: 'stun:stun.ekiga.net' },
    { url: 'stun:stun.fwdnet.net' },
    { url: 'stun:stun.ideasip.com' },
    { url: 'stun:stun.iptel.org' },
    { url: 'stun:stun.rixtelecom.se' },
    { url: 'stun:stun.schlund.de' },
    { url: 'stun:stun.l.google.com:19302' },
    { url: 'stun:stun1.l.google.com:19302' },
    { url: 'stun:stun2.l.google.com:19302' },
    { url: 'stun:stun3.l.google.com:19302' },
    { url: 'stun:stun4.l.google.com:19302' },
    { url: 'stun:stunserver.org' },
    { url: 'stun:stun.softjoys.com' },
    { url: 'stun:stun.voiparound.com' },
    { url: 'stun:stun.voipbuster.com' },
    { url: 'stun:stun.voipstunt.com' },
    { url: 'stun:stun.voxgratia.org' },
    { url: 'stun:stun.xten.com' },
    {
      url: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com',
    },
    {
      url: 'turn:192.158.29.39:3478?transport=udp',
      credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
      username: '28224511:1379330808',
    },
    {
      url: 'turn:192.158.29.39:3478?transport=tcp',
      credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
      username: '28224511:1379330808',
    },
  ]

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnections, setPeerConnections] = useState([]);
  const [webSocketSessionId, setWebSocketSessionId] = useState(null);
  const [mapPeers, setMapPeers] = useState(new Map());
  const [mapScreenPeers, setMapScreenPeers] = useState(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isShareScreen, setIsShareScreen] = useState(false);

  const joinedRoom = useRef(null);
  const [roomId, setRoomId] = useState(null);
  const [userId, setUserId] = useState(null);


  const [userType, setUserType] = useState(null);
  // const wsEndpoint = 'ws://localhost:8088';
  const wsEndpoint = 'wss://mango-live.website/ws/live-room/';
  const [peer, setPeer] = useState(null);
  const webSocket = useRef(null);
  const [alertText, setAlertText] = useState(null);
  const [message,setMessage] = useState(null);
  const messageList = useRef([]);

  // Function to stop screen sharing
  const stopScreenShare = () => {
    screenShareStream.getTracks().forEach(track => {
      local;

      Stream.removeTrack(track);
    });
    setScreenShareStream(null);
    localStream.getTracks().forEach(track => {
      track.enabled = true;
    });
  };

  // Function to start screen sharing
  const startScreenShare = async () => {
    setScreenShareStream(mediaDevices.getDisplayMedia());
    localStream.getTracks().forEach(track => {
      track.enabled = false;
    });
    screenShareStream.getTracks().forEach(track => {
      localStream.addTrack(track);
    });
  };

  // Function to toggle audio
  const toggleAudio = () => {
    setAudioEnabled(prevEnabled => !prevEnabled);
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !audioEnabled;
    });
  };

  // Function to toggle video
  const toggleVideo = () => {
    setVideoEnabled(prevEnabled => !prevEnabled);
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !videoEnabled;
    });
  };

  const switchCamera = () => {
    localStream.getVideoTracks().forEach(track => {
      track._switchCamera();
    });
  }

  const connectDevices = () => {
    // Get local media stream
    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == 'videoinput' &&
          sourceInfo.facing == (isFrontCamera ? 'user' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }
      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500, // Provide your own width, height and frame rate here
              minHeight: 300,
              minFrameRate: 30,
            },
            facingMode: isFrontCamera ? 'user' : 'environment',
            optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
          },
        })
        .then(stream => {
          setLocalStream(stream);
          stream.getTracks().forEach(track => {
            track.enabled = audioEnabled && videoEnabled;
          });
        });
    })
  };


  const setCurrentPeer = () => {
    var tempPeer= new RTCPeerConnection({ iceServers: ICESERVERS });
    setPeer(tempPeer);
  }

  useEffect(() => {
    if (!localStream && !peer) {
      setCurrentPeer();
      connectDevices();
    }
  }, [])

  const toggleScreenShare = () => {
    if (isShareScreen) {
      stopScreenShare();
    }
    else {
      startScreenShare();
    }
    setIsShareScreen(!isShareScreen);
  }

  const addLocalTracks = (peer, localScreenSharing)=>{
    if(!localScreenSharing){
        // if it is not a screen sharing peer
        // add user media tracks
        localStream.getTracks().forEach(track => {
            console.log('Adding localStream tracks.');
            peer.addStream(track);
        });

        return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    localDisplayStream.getTracks().forEach(track => {
        console.log('Adding localDisplayStream tracks.');
        peer.addStream(track);

    });
}
  // create RTCPeerConnection as offerer
  // and store it and its datachannel
  // send sdp to remote peer after gathering is complete
  createOfferer = async (srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {


    // add local user media stream tracks
    addLocalTracks(peer, localScreenSharing);

    // create and manage an RTCDataChannel
    var dc = peer.createDataChannel("channel");
    dc.onopen = () => {
      console.log("Connection opened.");
    };
    if (!localScreenSharing && !remoteScreenSharing) {
      // none of the peers are sharing screen (normal operation)

      // store the RTCPeerConnection
      // and the corresponding RTCDataChannel
      const tempMapPeers = mapPeers.set(srcPeerUserId, [peer, dc]);
      setMapPeers(tempMapPeers);
      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          console.log('Deleting peer');
          const tempMapPeers = mapPeers;
          tempMapPeers.delete(srcPeerUserId);
          setMapPeers(tempMapPeers);

          if (iceConnectionState != 'closed') {
            peer.close();
          }
          // removeVideo(remoteVideo);
        }
      };


    } else if (!localScreenSharing && remoteScreenSharing) {
      // answerer is screen sharing

      // remoteVideo = createVideo(srcPeerUserId + '-screen');
      // setOnTrack(peer, remoteVideo);
      // console.log('Remote video source: ', remoteVideo.srcObject);

      // if offer is not for screen sharing peer
      const tempMapPeers = mapPeers.set(srcPeerUserId + ' Screen', [peer, dc]);

      setMapPeers(tempMapPeers);

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {

          const tempMapPeers = mapPeers;

          tempMapPeers.delete(srcPeerUserId + ' Screen');
          setMapPeers(tempMapPeers);
      
          if (iceConnectionState != 'closed') {
            peer.close();
          }
          // removeVideo(remoteVideo);
        }
      };
    } else {
      // offerer itself is sharing screen

       const tempMapScreenPeers = mapScreenPeers.set(srcPeerUserId, [peer, dc]);
       setMapScreenPeers(tempMapScreenPeers);
      

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {

          const tempMapScreenPeers = this.state.mapScreenPeers;
          tempMapScreenPeers.delete(srcPeerUserId);
          setMapScreenPeers(tempMapScreenPeers);

          if (iceConnectionState != 'closed') {
            peer.close();
          }
        }
      };
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
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
        "room_id": joinedRoom,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
      });
    }

    peer.createOffer()
      .then(o => peer.setLocalDescription(o))
      .then(function (event) {
        console.log("Local Description Set successfully.");
      });

    console.log('mapPeers[', srcPeerUserId, ']: ', mapPeers.get(srcPeerUserId));

    setPeer(peer);
  }
const  createAnswerer = (offer, srcPeerUserId,destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) =>{
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



  const handleMessage = async (event) => {

    var parsedData = event.data
    var remoteScreenSharing = parsedData.local_screen_sharing;
    var localScreenSharing = parsedData.remote_screen_sharing;
    var src_user_id = parsedData.src_user_id;
    var dest_user_id = parsedData.dest_user_id;
    var parsed_room_id = parsedData.room_id;
    var receiver_channel_name = parsedData.receiver_channel_name;
    console.log("parsedData", parsedData)
    console.log("current user id :", userId);
    console.log("joinedRoom.current :", joinedRoom.current);
    if(!parsedData.action){
      return;
    }
    if (parsed_room_id != joinedRoom.current) {

      return;
    }

    try {
      if (parsedData.success == false && userId == dest_user_id) {
        throw new Error(parsedData.message);
      }
    }
    catch (e) {
      console.log("websocket error  ", e)
      Alert.alert("Websocket error : " + e.message);
      if (parsedData.action == "viewer_join_room") {
        webSocket.dispatchEvent({ type: "error", e });
        return
      }
    }

    if (dest_user_id && dest_user_id != userId) {
      // ignore all messages from oneself
      return;
    }


    switch (parsedData.action) {
      case 'viewer_join_room':
        console.log(`User ${parsedData.receiver_channel_name} joined room`);
        // when another user joins, create an RTCPeerConnection and send them an SDP offer
        createOfferer(src_user_id, dest_user_id, false, remoteScreenSharing, receiver_channel_name);
        if (isShareScreen && !remoteScreenSharing) {
          // if local screen is being shared
          // and remote peer is not sharing screen
          // send offer from screen sharing peer
          console.log('Creating screen sharing offer.');
          createOfferer(src_user_id, dest_user_id, false, remoteScreenSharing, receiver_channel_name);
        }
        break;
      case 'new-offer':
        console.log(`Current user ${userId} SDP Offer received from ${src_user_id} to user ${dest_user_id}`);
        // when another user sends an SDP offer, replay with an SDP Answer

        // create new RTCPeerConnection
        // set offer as remote description
        var offer = parsedData.sdp;
        createAnswerer(offer, src_user_id, dest_user_id, localScreenSharing, remoteScreenSharing, receiver_channel_name);

        break;
      case 'new-answer':
        // in case of answer to previous offer
        // get the corresponding RTCPeerConnection
        var peer = null;

        if (remoteScreenSharing) {
          // if answerer is screen sharer
          peer = mapPeers.get(src_user_id + ' Screen')[0];
        } else if (localScreenSharing) {
          // if offerer was screen sharer
          peer = mapScreenPeers[src_user_id][0];
        } else {
          // if both are non-screen sharers
          peer = mapPeers.get(src_user_id)[0];
        }

        // get the answer
        var answer = parsedData['sdp'];

        console.log('mapPeers:');
        for (key in mapPeers.keys()) {
          console.log(key, ': ', mapPeers.get(key));
        }

        console.log('peer: ', peer);
        console.log('answer: ', answer);

        // set remote description of the RTCPeerConnection
        peer.setRemoteDescription(answer);

        break;
      case "chat":
        console.log("send chat from "+src_user_id)
        console.log("current user id "+userId)
        if (userId == src_user_id) {
          return;
        }

        var messageData = parsedData.username + parsedData.message;
        Alert.alert(messageData);
        break;
      case "streamer_join_room":
        setWebSocketSessionId(receiver_channel_name);
        break;
      default:
        console.log("Nothing happened");
        break;
    }
    
  };

  const sendSignal = (action, data) => {
    console.log(action, data);
    webSocket.current.send(
      JSON.stringify(
        {
          'action': action,
          'data': data,
        }
      )
    )
  };


  const connectWs = () => {

    // eslint-disable-next-line no-undefz
    console.log("Prepare to connect ...");
    console.log("UserType ", userType)
    console.log("webSocket ", peer)

    if (!peer) {
      setCurrentPeer();
    }
    console.log("Start web socket")
    webSocket.current = new WebSocket(wsEndpoint);

    const currentWebSocket = webSocket.current;
    currentWebSocket.onopen = () => {
      console.log('WebSocket Client Connected');
      setAlertText(null);
      // notify other peers

      var action = userType == "streamer" ? "streamer_join_room" : "viewer_join_room";

      console.log("action : ", action);
      console.log("roomId : ", roomId)
      sendSignal(action, {
        'local_screen_sharing': false,
        "room_id": roomId, //TODO: fixme
        "dest_user_id": userId, //TODO: fixme
        "src_user_id": userId,
      });
    };
    currentWebSocket.onmessage = (e) => {
      handleMessage(JSON.parse(e.data));
    };
    currentWebSocket.onclose = (e) => {
      console.log(`Websocket Closed, ${e.code} ${e.reason}`);
      // show an error message
      setAlertText('Websocket is closed ' + wsEndpoint + ', is the backend started? Tap here to try reconnecting.');
    };
    currentWebSocket.onerror = (e) => {
      joinedRoom.current = null;
      throw new Error("Can't connect " + e);
    }
    joinedRoom.current =roomId;
    webSocket.current = currentWebSocket;
    console.log("Joined room ",joinedRoom.current);
  };

  const closePeer = async (sessionId) => {
    console.log('closePeer ', sessionId);
    const peer = mapPeers.get(sessionId)[0];
    if (peer) {
      peer.close();
    }
    const peers = mapPeers;
    peers.delete(sessionId);

    setMapPeers(peers);
    removeVideo(sessionId);
  };


  const joinOrLeaveRoom = () => {
    // leave the room if already in one
    console.log("JoinORLEave ",joinedRoom.current);
    if (joinedRoom.current) {


      [...mapPeers.keys()].forEach(async (key) => {
        try {
          await closePeer(key);
        } catch (e) {
          console.warn(`Error closing peer ${key} : ${e}`);
        }
      });

      [...mapScreenPeers.keys()].forEach(async (key) => {
        try {
          await closePeer(key);
        } catch (e) {
          console.warn(`Error closing screen peers ${key}`);
        }
      });
      joinedRoom.current=null;
      setRoomId(null);
      return;
    }
    const roomInputValue = roomId;
    // alert that the room name is required
    if (roomInputValue.length === 0) {
      Alert.alert('Room Name is required.');
      return;
    }

    try {

      connectWs();
      // actually join the room if the above checks pass
    }
    catch (e) {
      Alert.alert(e.message);
      return;
    }
  };

  return (
    <View style={[styles.flex, styles.rootContainer]}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.flex, styles.rootContainer]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.flex, styles.borderedContainer]}>
            <Text style={styles.label}>Video</Text>
            {alertText && (
              <TouchableOpacity onPress={connectWs}>
                <Text style={styles.alertLabel}>{alertText}</Text>
              </TouchableOpacity>
            )}
            {userType=="streamer" && localStream ? (
              <RTCView
                objectFit={'cover'}
                style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                streamURL={localStream.toURL()}
              />
            ) : null}
          </View>

          
          <View style={[styles.flex, styles.borderedContainer]}>
            <Text style={styles.label}>Streamer Video</Text>
            {alertText && (
              <TouchableOpacity onPress={connectWs}>
                <Text style={styles.alertLabel}>{alertText}</Text>
              </TouchableOpacity>
            )}
            {userType!="streamer" && remoteStream ? (
              <RTCView
                objectFit={'cover'}
                style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                streamURL={remoteStream.toURL()}
              />
            ) : null}
          </View>
          <View >

            <Text style={styles.label}>
              Chat {joinedRoom.current}
            </Text>
            {joinedRoom.current!=null && (
              <>
                <TextInput
                  onChangeText={(msg)=>{setMessage(msg)}}
                  placeholder={'message'}
                  // onSubmitEditing={this.joinOrLeaveRoom}
                  // returnKeyType={'join'}
                  value={message}
                  style={{ flexGrow: 1 }}
                />
                <Button
                  onPress={() => {
                    let currentMessage = message;
                    // send offer to new peer
                    // after ice candidate gathering is complete
                    sendSignal('chat', {
                      "room_id": roomId,
                      "src_user_id": userId,
                      "message": currentMessage,
                    });
                    
                    setMessage(null);
                  }}
                  title='Send'
                >
                </Button>
              </>

            )}

          </View>

          <View style={styles.shrinkingContainer}>
            <View>
              <Text style={styles.label}>
                Room Name
                {joinedRoom.current && `: ${joinedRoom.current}`}
              </Text>
              {!joinedRoom.current && (
                <TextInput
                  onChangeText={(value) => {
                    setRoomId(value)
                  }}
                  placeholder={'Room Name'}
                  testID={'roomInput'}
                  // onSubmitEditing={this.joinOrLeaveRoom}
                  // returnKeyType={'join'}
                  value={roomId}
                  style={styles.roomInput}
                />
              )}
            </View>
          </View>
          <View style={styles.shrinkingContainer}>
            <View>
              <Text style={styles.label}>
                User ID
                {joinedRoom.current && `: ${userId}`}
              </Text>
              {!joinedRoom.current && (
                <TextInput
                  onChangeText={(value)=>{setUserId(value)}}
                  placeholder={'User ID'}
                  // returnKeyType={'join'}
                  value={userId}
                  style={styles.roomInput}
                />
              )}
            </View>
          </View>

          <View style={styles.shrinkingContainer}>
            <View>
              <Dropdown
                style={[styles.dropdown,]}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={userTypeData}
                maxHeight={300}
                labelField="label"
                valueField="value"
                value={userType}
                onChange={item => {
                  setUserType(item["value"]);
                }}
                renderLeftIcon={() => (
                  <AntDesign
                    style={styles.icon}
                    color='blue'
                    name="Safety"
                    size={20}
                  />
                )}
                disable={joinedRoom.current}

              />
            </View>
          </View>

          <View style={styles.shrinkingContainer}>
            <View>
              <RoundedButton
                text={joinedRoom.current ? 'Leave Room' : 'Join Room'}
                onPress={joinOrLeaveRoom}
                testID={
                  joinedRoom.current ? 'leaveRoomButton' : 'joinRoomButton'
                }
              />
            </View>
          </View>

          <View>
            <Button
              onPress={toggleAudio}
              title={audioEnabled ? "Audio Mute" : "Audio Unmute"}
            ></Button>

            <Button
              onPress={toggleVideo}
              title={videoEnabled ? "Video Stop" : "Video Start"}
            ></Button>
            <Button
              onPress={switchCamera}
              title="Switch Camera"
            ></Button>
            <Button
              onPress={toggleScreenShare}
              title={isShareScreen ? "Stop Screen Share" : "Start Screen Share"}
            />
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>

  )
}

export default Demo