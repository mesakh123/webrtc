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
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun01.sipphone.com' },
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.fwdnet.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.iptel.org' },
    { urls: 'stun:stun.rixtelecom.se' },
    { urls: 'stun:stun.schlund.de' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stunserver.org' },
    { urls: 'stun:stun.softjoys.com' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.voxgratia.org' },
    { urls: 'stun:stun.xten.com' },
  ]

  const [localStream, setLocalStream] = useState(null);
  const [localDisplayStream, setLocalDisplayStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(new Map());
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
  const webSocket = useRef(null);
  const [alertText, setAlertText] = useState(null);
  const [message, setMessage] = useState(null);
  const [streamerId, setStreamerId] = useState(4);//todo: fixme
  const messageList = useRef([]);
  const getPeers = (peerStorageObj) => {
    var peers = [];

    for (peerUsername in peerStorageObj) {
      var peer = peerStorageObj[peerUsername][0];
      console.log('peer: ', peer);

      peers.push(peer);
    }

    return peers;
  }
  // Function to stop screen sharing
  const stopScreenShare = () => {
    var currentMapScreenPeers = mapScreenPeers;
    var screenPeers = getPeers(currentMapScreenPeers);
    for (index in screenPeers) {
      screenPeers[index].close();
    }
    setScreenShareStream(null);
  };

  // Function to start screen sharing
  const startScreenShare = () => {
    mediaDevices.getDisplayMedia({ audio: false, video: false })
      .then(stream => {
        setLocalDisplayStream(stream);
        stream.getTracks().forEach(track => {
          track.enabled = false;
        });
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
    console.log("Get local media");
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

  const setOnTrack = (peer, srcPeerUserId) => {

    peer.onaddstream = event => {
      setRemoteStream(new Map([[srcPeerUserId, event.stream]]))
    }
  }

  const mappingOfferPeerConnection = (srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection, dc) => {
    var currentMapPeers = null;

    if (!localScreenSharing && !remoteScreenSharing) {

      // store the RTCPeerConnection
      // and the corresponding RTCDataChannel
      currentMapPeers = mapPeers.set(srcPeerUserId, [peerConnection, dc])
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          console.log('Deleting peer ', peerConnection);
          currentMapPeers.delete(srcPeerUserId)
          if (iceConnectionState != 'closed') {
            peerConnection.close();
          }
        }
      };
      setMapPeers(new Map(currentMapPeers))
    }
    else if (!localScreenSharing && remoteScreenSharing) {
      // answerer is screen sharing

      currentMapPeers = mapPeers.set(srcPeerUserId + ' Screen', [peerConnection, dc])

      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          currentMapPeers.delete(srcPeerUserId)
          if (iceConnectionState != 'closed') {
            peerConnection.close();
          }
        }
      };
      setMapPeers(new Map(currentMapPeers))

    }
    else {
      currentMapPeers = mapScreenPeers.set(srcPeerUserId, [peerConnection, dc])
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          currentMapPeers.delete(srcPeerUserId)
          if (iceConnectionState != 'closed') {
            peerConnection.close();
          }
        }
      };
      setMapScreenPeers(new Map(currentMapPeers))
    }
  };


  const addLocalTracks = (peer, localScreenSharing) => {
    console.log("addLocalTracks localStream:", localStream)
    if (!localScreenSharing) {
      // if it is not a screen sharing peer
      // add user media tracks

      peer.addStream(localStream);
      return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    peer.addStream(localDisplayStream);

  }


  const createOfferer = (srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
    console.log("Create offerer " + srcPeerUserId + " to " + destPeerUserId);
    const peerConnection = new RTCPeerConnection({ iceservers: ICESERVERS });

    addLocalTracks(peerConnection, localScreenSharing);

    // create and manage an RTCDataChannel
    var dc = peerConnection.createDataChannel("channel");
    dc.onopen = () => {
      console.log("Connection opened.");
    };

    mappingOfferPeerConnection(srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection, dc);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        return;
      }
      console.log('Gathering finished! Sending offer SDP to ', srcPeerUserId, '.');
      console.log('receiverChannelName: ', receiver_channel_name);

      // send offer to new peer
      // after ice candidate gathering is complete
      sendSignal('new-offer', {
        'sdp': peerConnection.localDescription,
        'receiver_channel_name': receiver_channel_name,
        'local_screen_sharing': localScreenSharing,
        'remote_screen_sharing': remoteScreenSharing,
        "room_id": joinedRoom.current,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
      });
    }

    peerConnection.createOffer()
      .then(o => peerConnection.setLocalDescription(o))
      .then(function (event) {
        console.log("Local Description Set successfully.");
      });

  }

  const mappingAnswerPeerConnection = (srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection) => {
    if (!localScreenSharing && !remoteScreenSharing) {
      // if none are sharing screens (normal operation)

      // it will have an RTCDataChannel
      var currentMapPeers = mapPeers;
      setOnTrack(peerConnection, srcPeerUserId);
      peerConnection.ondatachannel = e => {
        console.log('e.channel.label: ', e.channel.label);
        peerConnection.dc = e.channel;

        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(srcPeerUserId, [peerConnection, peerConnection.dc]);

      }

      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          currentMapPeers.delete(srcPeerUserId);
          if (iceConnectionState != 'closed') {
            peerConnection.close();
          }
        }
      };
      setMapPeers(new Map(currentMapPeers));
    }
    else if (localScreenSharing && !remoteScreenSharing) {
      // answerer itself is sharing screen

      var currentMapPeers = mapScreenPeers;
      // it will have an RTCDataChannel
      peerConnection.ondatachannel = e => {
        peerConnection.dc = e.channel;
        // this peer is a screen sharer
        // so its connections will be stored in mapScreenPeers
        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(srcPeerUserId, [peerConnection, peerConnection.dc]);

        peerConnection.oniceconnectionstatechange = () => {
          var iceConnectionState = peerConnection.iceConnectionState;
          if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            currentMapPeers.delete(srcPeerUserId);
            if (iceConnectionState != 'closed') {
              peerConnection.close();
            }
          }
        };
      }
      setMapScreenPeers(new Map(currentMapPeers));
    }

    else {
      // offerer is sharing screen
      var currentMapPeers = mapPeers;
      setOnTrack(peerConnection);
      // it will have an RTCDataChannel
      peerConnection.ondatachannel = e => {
        peerConnection.dc = e.channel;
        peerConnection.dc.onmessage = evt => {
          console.log('New message from %s\'s screen: ', srcPeerUserId, evt.data);
        }
        peerConnection.dc.onopen = () => {
          console.log("Connection opened.");
        }

        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(srcPeerUserId + ' Screen', [peerConnection, peerConnection.dc]);

      }
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          currentMapPeers.delete(srcPeerUserId + ' Screen');
          if (iceConnectionState != 'closed') {
            peerConnection.close();
          }
        }
      };
      setMapPeers(new Map(currentMapPeers));

    }
  }
  const createAnswerer = (offer, srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
    console.log("Create answerer")
    const peerConnection = new RTCPeerConnection({ iceservers: ICESERVERS });

    // add current local stream
    addLocalTracks(peerConnection)

    mappingAnswerPeerConnection(srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        return;
      }
      console.log('Gathering finished! Sending answer SDP to ', srcPeerUserId, '.');
      console.log('receiverChannelName: ', receiver_channel_name);

      // send offer to new peer
      // after ice candidate gathering is complete
      sendSignal('new-answer', {
        'sdp': peerConnection.localDescription,
        'receiver_channel_name': receiver_channel_name,
        'local_screen_sharing': localScreenSharing,
        'remote_screen_sharing': remoteScreenSharing,
        "room_id": joinedRoom.current,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
      });
    }

    peerConnection.setRemoteDescription(offer)
      .then(() => {
        console.log('Set offer from %s.', srcPeerUserId);
        return peerConnection.createAnswer();
      })
      .then(a => {
        return peerConnection.setLocalDescription(a);
      })
      .then(() => {
        console.log('Answer created for %s.', srcPeerUserId);
        console.log('localDescription: ', peerConnection.localDescription);
        console.log('remoteDescription: ', peerConnection.remoteDescription);
      })
      .catch(error => {
        console.log('Error creating answer for %s.', srcPeerUserId);
        console.log(error);
      });

  }


  useEffect(() => {
    connectDevices();
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

  const receiveNewAnswer = (sdp, src_user_id, localScreenSharing, remoteScreenSharing) => {
    console.log("received new sdp ", sdp);
    var peerKey = src_user_id;
    var currentMapPeers = mapPeers;
    var currentPeerConnection = null;
    var currentPeersDC = null;
    if (remoteScreenSharing) {
      // if answerer is screen sharer
      peerKey = src_user_id + ' Screen';
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
      currentPeersDC = currentMapPeers.get(peerKey)[1];
    } else if (localScreenSharing) {
      currentMapPeers = mapScreenPeers;
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
      currentPeersDC = currentMapPeers.get(peerKey)[1];
    } else {
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
      currentPeersDC = currentMapPeers.get(peerKey)[1];
    }
    // set remote description of the RTCPeerConnection
    currentPeerConnection.setRemoteDescription(sdp);
    currentMapPeers = currentMapPeers.set(src_user_id, [currentPeerConnection, currentPeersDC])
    if (peerKey == src_user_id) {
      setMapPeers(new Map(currentMapPeers));
    }
    else {
      setMapScreenPeers(new Map(currentMapPeers));

    }

  }

  const handleMessage = async (event) => {

    var parsedData = event.data
    var remoteScreenSharing = parsedData.local_screen_sharing;
    var localScreenSharing = parsedData.remote_screen_sharing;
    var src_user_id = parsedData.src_user_id;
    var dest_user_id = parsedData.dest_user_id;
    var parsed_room_id = parsedData.room_id;
    var receiver_channel_name = parsedData.receiver_channel_name;
    var currentAction = parsedData.action;
    console.log("current user id :", userId);
    console.log("src_user_id :", src_user_id)
    console.log("dest_user_id :", dest_user_id)
    console.log("parsed_room_id :", parsed_room_id)
    console.log("joinedRoom.current :", joinedRoom.current);
    console.log("action :", parsedData.action);
    console.log("");

    if (!currentAction) {
      console.log("skipped current action:", currentAction);
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


    switch (currentAction) {
      case "streamer_join_room":
        if (userId == src_user_id) {
          console.log("Current user " + userId + " is streamer, joined the room");
        }

        break;
      case 'viewer_join_room':
        createOfferer(src_user_id, dest_user_id, false, remoteScreenSharing, receiver_channel_name);
        console.log("isShareScreen", isShareScreen)
        console.log("remoteScreenSharing", remoteScreenSharing)
        if (isShareScreen && !remoteScreenSharing) {
          createOfferer(src_user_id, dest_user_id, true, remoteScreenSharing, receiver_channel_name);
        }
        break;
      case 'new-offer':
        var offer = parsedData.sdp;
        console.log('Got new offer from ', src_user_id);
        createAnswerer(offer, src_user_id, dest_user_id, localScreenSharing, remoteScreenSharing, receiver_channel_name);
        break;
      case 'new-answer':
        console.log("dest user id == curret user id")
        receiveNewAnswer(parsedData.sdp, src_user_id, localScreenSharing, remoteScreenSharing);
        break;
      case "chat":
        if (userId != src_user_id) {
          var nodeText = parsedData["username"] + " : " + parsedData["message"];
          Alert.alert(nodeText);
        }
        break;
      default:
        break;
    }

  };

  const sendSignal = (action, data) => {
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

    console.log("Start web socket")
    webSocket.current = new WebSocket(wsEndpoint);

    webSocket.current.onopen = () => {
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
    webSocket.current.onmessage = (e) => {
      handleMessage(JSON.parse(e.data));
    };
    webSocket.current.onclose = (e) => {
      console.log(`Websocket Closed, ${e.code} ${e.reason}`);
      // show an error message
      setAlertText('Websocket is closed ' + wsEndpoint + ', is the backend started? Tap here to try reconnecting.');
    };
    webSocket.current.onerror = (e) => {
      joinedRoom.current = null;
      throw new Error("Can't connect " + e);
    }
    joinedRoom.current = roomId;
    console.log("Joined room ", joinedRoom.current);
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
    console.log("JoinORLEave ", joinedRoom.current);
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
      joinedRoom.current = null;
      setRoomId(null);
      return;
    }
    const roomInputValue = roomId;
    // alert that the room name is required
    if (roomInputValue.length === 0) {
      Alert.alert('Room Name is required.');
      return;
    }
    connectWs();

    try {

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

            {alertText ? (
              <TouchableOpacity onPress={joinOrLeaveRoom}>
                <Text style={styles.alertLabel}>{alertText}</Text>
              </TouchableOpacity>
            ) : null}
            {(userType == "streamer") ? (

              <>
                <Text style={styles.label}>Video</Text>
                {
                  localStream ? (
                    <>

                      <RTCView
                        objectFit={'cover'}
                        style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                        streamURL={localStream.toURL()}
                      />
                    </>) : null
                }
              </>

            ) : (
              <>
                <Text style={styles.label}>Streamer Video</Text>
                {
                  remoteStream ? (
                    [...remoteStream.keys()].forEach(async (key) => {
                      {
                        key == streamerId ? (<RTCView
                          objectFit={'cover'}
                          style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                          key={key}
                          streamURL={remoteStream.get(key).toURL()}
                        />) : null
                      }
                    })
                  ) : null
                }
              </>

            )}
          </View>


          <View >

            <Text style={styles.label}>
              Chat {joinedRoom.current}
            </Text>
            {joinedRoom.current != null && (
              <>
                <TextInput
                  onChangeText={(msg) => { setMessage(msg) }}
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
                  onChangeText={(value) => { setUserId(value) }}
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