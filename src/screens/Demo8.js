import React, { useCallback, useEffect, useRef, useState } from "react";
import uuid from "react-native-uuid";
import {
  Alert,
  SafeAreaView,
  TextInput,
  Platform,
  View,
  Text,
  StatusBar,
  KeyboardAvoidingView,
  Button,
} from "react-native";
import notifee from "@notifee/react-native";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";
import styles from "./AppStyles";
import RoundedButton from "./RoundedButton";
import { Dropdown } from "react-native-element-dropdown";
import AntDesign from "react-native-vector-icons/AntDesign";

// const mapPeers = {};
// const mapScreenPeers = {}

function Demo8() {
  const [localStream, setLocalStream] = useState(null);
  // const [localDisplayStream, setLocalDisplayStream] = useState(null);
  const localDisplayStream = useRef(null);
  // const [remoteStreams, setRemoteStreams] = useState(new Map());
  const remoteStreams = useRef(new Map());
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteDisplayStream, setRemoteDisplayStream] = useState(null);
  const screenCaptureView = useRef(null);
  const [peerConnections, setPeerConnections] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [isShareScreen, setIsShareScreen] = useState(false);
  const [isJoin, setIsJoin] = useState(false);
  const [message, setMessage] = useState(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);

  const userId = useRef(uuid.v4());
  const mapPeers = useRef(new Map());
  const mapScreenPeers = useRef(new Map());

  const wsEndPoint = "wss://mango-live.website/ws/test-live-room/";
  const webSocket = useRef(null);

  const startNotification = async () => {
    try {
      let channelId = await notifee.createChannel({
        id: "default",
        name: "Default Channel",
      });
      await notifee.displayNotification({
        title: "Sharing screen...",
        body: "在应用中手动关闭该通知",
        android: {
          channelId,
          asForegroundService: true,
        },
      });
    } catch (err) {
      console.error("前台服务启动异常：", err);
    }
  };

  useEffect(() => {
    // Get local media stream
    connectDevices();
  }, []);

  const setICEConnectionStateChange = (peerConnection, newPeerNameInfo) => {
    var srcPeerUserId = newPeerNameInfo[0];
    var isMapPeers = newPeerNameInfo[1];

    var currentMapPeers = mapPeers.current;

    if (!isMapPeers) {
      currentMapPeers = mapScreenPeers.current;
    }

    peerConnection.oniceconnectionstatechange = () => {
      var iceConnectionState = peerConnection.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        if (iceConnectionState !== "closed") {
          peerConnection.close();
          currentMapPeers.delete(srcPeerUserId);
        }
      }
    };
    if (isMapPeers) {
      mapPeers.current = new Map(currentMapPeers);
    } else {
      mapScreenPeers.current = new Map(currentMapPeers);
    }
  };

  const mappingOfferPeerConnectionTracks = (
    peer,
    peerUserId,
    localScreenSharing,
    remoteScreenSharing
  ) => {
    const dataChannel = peer.createDataChannel("channel");
    var peerUsername = peerUserId;
    var isMapPeer = true;
    if (!localScreenSharing && !remoteScreenSharing) {
      // none of the peers are sharing screen (normal operation)
      // store the RTCPeerConnection
      // and the corresponding RTCDataChannel
      mapPeers.current.set(peerUsername, [peer, dataChannel]);
      setRemoteTracks(peer, peerUserId, false);
    } else if (!localScreenSharing && remoteScreenSharing) {
      // answerer is screen sharing
      peerUsername = peerUsername + " Screen";
      setRemoteTracks(peer, peerUsername, true);
      mapPeers.current.set(peerUsername, [peer, dataChannel]);
    } else {
      // offerer itself is sharing screen
      mapScreenPeers.current.set(peerUsername, [peer, dataChannel]);
      isMapPeer = false;
    }
    return [peerUsername, isMapPeer];
  };

  const setRemoteTracks = async (
    peer,
    srcPeerUserId,
    isRemoteDisplayStream
  ) => {
    var mediaStream = new MediaStream();
    if (remoteStreams.current) {
      remoteStreams.current.set(srcPeerUserId, mediaStream);
    } else {
      remoteStreams.current = new Map([srcPeerUserId, mediaStream]);
    }

    if (isRemoteDisplayStream) {
      console.log("set remote display stream from ",srcPeerUserId);
      setRemoteDisplayStream(mediaStream);
    } else {
      setRemoteStream(mediaStream);
    }
    peer.ontrack = (event) => {
      mediaStream.addTrack(event.track, mediaStream);
    };

    peer.onaddstream = async (event) => {
      remoteStreams.current.set(srcPeerUserId, event.stream);
      if (isRemoteDisplayStream) {
        setRemoteDisplayStream(event.stream);
      } else {
        setRemoteStream(event.stream);
      }
    };
  };

  const connectDevices = () => {
    // Get local media stream
    mediaDevices.enumerateDevices().then((sourceInfos) => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == "videoinput" &&
          sourceInfo.facing == (isFrontCamera ? "user" : "environment")
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
            facingMode: isFrontCamera ? "user" : "environment",
            optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
          },
        })
        .then((stream) => {
          setLocalStream(stream);
          stream.getTracks().forEach((track) => {
            track.enabled = audioEnabled && videoEnabled;
          });
        });
    });
  };

  const receiveNewAnswer = (
    sdp,
    src_user_id,
    localScreenSharing,
    remoteScreenSharing
  ) => {
    var peerKey = src_user_id;
    var currentMapPeers = mapPeers.current;
    var currentPeerConnection = null;
    // set remote description of the RTCPeerConnection
    if (remoteScreenSharing) {
      // if answerer is screen sharer
      peerKey = src_user_id;
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    } else if (localScreenSharing) {
      currentMapPeers = mapScreenPeers.current;
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    } else {
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    }
    currentPeerConnection.setRemoteDescription(sdp);
  };
  const iceServers = [
    {
      urls: "stun:freeturn.net:3478",
    },
    {
      urls: "stun:freeturn.net:5349",
    },
    {
      urls: "turn:freeturn.net:3478",
      username: "free",
      credential: "free",
    },
    {
      urls: "turns:freeturn.net:5349",
      username: "free",
      credential: "free",
    },
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "efd7e25209beee9eca3d6ef9",
      credential: "eFD2V65kF3b04lXG",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "efd7e25209beee9eca3d6ef9",
      credential: "eFD2V65kF3b04lXG",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "efd7e25209beee9eca3d6ef9",
      credential: "eFD2V65kF3b04lXG",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "efd7e25209beee9eca3d6ef9",
      credential: "eFD2V65kF3b04lXG",
    },
  ];
  //Configuration of STUN AND TURN Servers
  const configuration = {
    iceServers: iceServers,
  };

  const addMediaTracks = (peerConnection, localScreenSharing) => {
    if(!localScreenSharing){
      peerConnection.addStream(localStream);
      localStream.getTracks().forEach((track) => {
        peerConnection.getLocalStreams()[0].addTrack(track);
      });
      return
    }
    peerConnection.addStream(localDisplayStream.current);
    localDisplayStream.current.getTracks().forEach((track) => {
      peerConnection.getLocalStreams()[0].addTrack(track);
    });
    
  };
  //Trickle ICE (Send ICE Candidates to remote peer)
  function setIceCandidateEvent(
    peerConnection,
    receiver_channel_name,
    newPeerNameInfo
  ) {
    //Setting onicecandidate
    //Listen for local ICE candidates on the local RTCPeerConnection
    //Send IceCandidates to peer
    var isScreen = false;
    if (!newPeerNameInfo[1]) {
      isScreen = true;
    }
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ICECandidate", {
          ice_candidate: event.candidate,
          receiver_channel_name: receiver_channel_name,
          is_screen: isScreen,
        });
      } else {
        console.log("All ICE candidates have been sent!!");
      }
    };
  }

  const CreateOfferRTCPeerConnection = (
    peerUserId,
    localScreenSharing,
    remoteScreenSharing,
    receiver_channel_name
  ) => {
    const peerConnection = new RTCPeerConnection(configuration);
    //   peerConnectionends.push(peerConnection);

    addMediaTracks(peerConnection, localScreenSharing);

    //Create video element for remote Peer
    var newPeerNameInfo = mappingOfferPeerConnectionTracks(
      peerConnection,
      peerUserId,
      localScreenSharing,
      remoteScreenSharing
    );

    //set the oniceconnectionstatechange event
    setICEConnectionStateChange(peerConnection, newPeerNameInfo);

    //Set the onicecandidate event
    setIceCandidateEvent(
      peerConnection,
      receiver_channel_name,
      newPeerNameInfo
    );

    //CreateOffer
    peerConnection
      .createOffer()
      .then((offer) => {
        peerConnection
          .setLocalDescription(offer)
          .then(() => {
            console.log("Sending offer");
            sendSignal("new-offer", {
              sdp: offer,
              receiver_channel_name: receiver_channel_name,
              local_screen_sharing: localScreenSharing,
              remote_screen_sharing: remoteScreenSharing,
            });
          })
          .catch((error) => {
            console.log("Error in setLocalDesc: ", error);
          });
      })
      .catch((error) => {
        console.log("Error in creating offer", error);
      });

    //console.log("Peer Connection: ",peerConnection);
    return peerConnection;
  };

  const mappingAnswerPeerConnectionTracks = (
    peer,
    peerUserId,
    localScreenSharing,
    remoteScreenSharing
  ) => {
    var peerUsername = peerUserId;
    var isMapPeer = true;
    if (!localScreenSharing && !remoteScreenSharing) {
      // if none are sharing screens (normal operation)

      // set remote video
      setRemoteTracks(peer, peerUsername, false);

      // it will have an RTCDataChannel
      peer.ondatachannel = (e) => {
        peer.dc = e.channel;
        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        mapPeers.current.set(peerUsername, [peer, peer.dc]);
      };
    } else if (localScreenSharing && !remoteScreenSharing) {
      // answerer itself is sharing screen
      isMapPeer = false;
      // it will have an RTCDataChannel
      peer.ondatachannel = (e) => {
        peer.dc = e.channel;
        // this peer is a screen sharer
        // so its connections will be stored in mapScreenPeers
        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        mapScreenPeers.current.set(peerUsername, [peer, peer.dc]);
      };
    } else {
      // offerer is sharing screen

      // set remote video
      peerUsername = peerUsername + " Screen";
      // and add tracks to remote video
      setRemoteTracks(peer, peerUsername, true);

      // it will have an RTCDataChannel
      peer.ondatachannel = (e) => {
        peer.dc = e.channel;
        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        mapPeers.current.set(peerUsername, [peer, peer.dc]);
      };
    }

    return [peerUsername, isMapPeer];
  };

  const CreateAnswerRTCPeerConnection = (
    offer,
    peerUserId,
    receiver_channel_name,
    localScreenSharing,
    remoteScreenSharing
  ) => {
    const peerConnection = new RTCPeerConnection(configuration);

    addMediaTracks(peerConnection, localScreenSharing);

    //Create video element for remote Peer
    var newPeerNameInfo = mappingAnswerPeerConnectionTracks(
      peerConnection,
      peerUserId,
      localScreenSharing,
      remoteScreenSharing
    );

    //set the oniceconnectionstatechange event
    setICEConnectionStateChange(peerConnection, newPeerNameInfo);

    //Set the onicecandidate event
    setIceCandidateEvent(
      peerConnection,
      receiver_channel_name,
      newPeerNameInfo
    );

    //CreateAnswer
    if (offer) {
      peerConnection
        .setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
          peerConnection.createAnswer().then((answer) => {
            peerConnection.setLocalDescription(answer).then(() => {
              console.log("Sending answer");
              sendSignal("new-answer", {
                sdp: answer,
                receiver_channel_name: receiver_channel_name,
                local_screen_sharing: localScreenSharing,
                remote_screen_sharing: remoteScreenSharing,
              });
            });
          });
        });
    }

    //console.log("Peer Connection: ",peerConnection);
    return peerConnection;
  };

  const receiveAnswer = async (peerConnection, answer) => {
    if (answer) {
      const remoteDesc = new RTCSessionDescription(answer);
      await peerConnection.setRemoteDescription(remoteDesc);
      //console.log("Remote desc done");
    }
  };

  const receiveICECandidates = async (peerUserId, ice_candidate, is_screen) => {
    if (!ice_candidate) {
      console.log("ICE candidate is empty");
      return;
    }

    try {
      if (is_screen) {
        if (mapScreenPeers.current.has(peerUserId)) {
          mapScreenPeers.current
            .get(peerUserId)[0]
            .addIceCandidate(ice_candidate);
        } else {
          mapPeers.current
            .get(peerUserId + " Screen")[0]
            .addIceCandidate(ice_candidate);
        }
      } else {
        mapPeers.current.get(peerUserId)[0].addIceCandidate(ice_candidate);
      }

    } catch (error) {
      console.error("Error adding received ice candidate", error);
    }
  };

  const handleMessage = (event) => {
    // Handle 'join' message
    var parsedData = event;
    var peerUserId = parsedData.peer;
    console.log("peerUserId", peerUserId);
    console.log("userId", userId.current);
    if (peerUserId === userId.current) {
      return;
    }

    var action = parsedData.action;
    console.log("action", action);
    if (
      action == "ICECandidate" &&
      (mapPeers.current.has(peerUserId) ||
        mapPeers.current.has(peerUserId + " Screen") ||
        mapScreenPeers.current.has(peerUserId))
    ) {
      let ice_candidate = parsedData.message.ice_candidate;
      let is_screen = parsedData.message.is_screen;
      console.log("is_screen", is_screen);
      receiveICECandidates(peerUserId, ice_candidate, is_screen);
      return;
    }

    var remoteScreenSharing = parsedData.message.local_screen_sharing;
    var localScreenSharing = parsedData.message.remote_screen_sharing;
    var receiver_channel_name = parsedData.message.receiver_channel_name;

    if (action == "new-peer") {
      console.log(
        "Create new offer from user " +
         userId.current+ " to "+
          peerUserId
      );
      CreateOfferRTCPeerConnection(
        peerUserId,
        false,
        remoteScreenSharing,
        receiver_channel_name
      );
      if (isShareScreen && !remoteScreenSharing) {
        CreateOfferRTCPeerConnection(
          peerUserId,
          true,
          remoteScreenSharing,
          receiver_channel_name
        );
      }

      console.log(
        `Current ${userId.current} mapping user ${peerUserId} in map peers (new-peer)`
      );
      return;
    } else if (action == "new-offer") {
      var offer = parsedData.message.sdp;
      console.log(
        "Create new answer from user " +
         userId.current+ " to "+
          peerUserId
      );
      CreateAnswerRTCPeerConnection(
        offer,
        peerUserId,
        receiver_channel_name,
        localScreenSharing,
        remoteScreenSharing
      );
     
      return;
    } else if (
      action == "new-answer" &&
      (mapPeers.current.has(peerUserId) ||
        mapScreenPeers.current.has(peerUserId) ||
        mapPeers.current.has(peerUserId + " Screen"))
    ) {
      var peerConnection = null;
      if (remoteScreenSharing) {
        // if answerer is screen sharer
        peerConnection = mapPeers.current.get(peerUserId + " Screen")[0];
      }
      else if(localScreenSharing){
        // if offerer was screen sharer
        peerConnection = mapScreenPeers.current.get(peerUserId)[0];
      }else{
        // if both are non-screen sharers
        peerConnection = mapPeers.current.get(peerUserId )[0];

      }
      var offer = parsedData.message.sdp;
      console.log(
        "Receive answer from user " +
        peerUserId + " to "+userId.current
          
      );
      receiveAnswer(peerConnection, parsedData.message.sdp);
      console.log(
        `Current ${userId.current} has user ${peerUserId} in map peers (new-answer)`
      );
      return;
    } else if (action == "chat") {
      var comingMessage = parsedData.message.message;
      Alert.alert(comingMessage);
      return;
    }
  };

  // Function to toggle audio
  const toggleAudio = () => {
    setAudioEnabled((prevEnabled) => !prevEnabled);
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !audioEnabled;
    });
  };

  // Function to toggle video
  const toggleVideo = () => {
    setVideoEnabled((prevEnabled) => !prevEnabled);
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !videoEnabled;
    });
  };

  // Function to start screen sharing
  const startScreenShare = async () => {
    await startNotification();
    await mediaDevices
      .getDisplayMedia({ audio: true, video: true })
      .then((stream) => {
        localDisplayStream.current = stream;
        // if (localStream) {
        //     localStream.getTracks().forEach(track => {
        //         track.enabled = false;
        //     });
        //     localDisplayStream.current.getTracks().forEach(track => {
        //         localStream.addTrack(track);
        //     });
        // }

        sendSignal("new-peer", {
          local_screen_sharing: true,
        });
      });

    console.log("share screen started");
  };

  // Function to stop screen sharing
  const stopScreenShare = async () => {
    localDisplayStream.current.getTracks().forEach((track) => {
      localStream.removeTrack(track);
      track.stop();
    });
    localDisplayStream.current = null;

    localStream.getTracks().forEach((track) => {
      track.enabled = true;
    });

    if (mapScreenPeers.current) {
      for (let channel of mapScreenPeers.current.values()) {
        channel.close();
      }
    }
  };

  const stopForeGroundService = async () => {
    try {
      await notifee.stopForegroundService();
    } catch (err) {
      console.log(err);
    }
  };

  const toggleShareScreen = async () => {
    if (isShareScreen) {
      setIsShareScreen(false);
      await stopForeGroundService();
      await stopScreenShare();
    } else {
      setIsShareScreen(true);
      await startScreenShare();
    }
  };

  const connectWs = () => {
    // eslint-disable-next-line no-undefz
    console.log("Prepare to connect ...");

    console.log("Start web socket");
    webSocket.current = new WebSocket(wsEndPoint);

    webSocket.current.onopen = () => {
      console.log("WebSocket Client Connected");
      // notify other peers

      sendSignal("new-peer", {
        local_screen_sharing: false,
      });
    };
    webSocket.current.onmessage = (e) => {
      handleMessage(JSON.parse(e.data));
    };
    webSocket.current.onclose = (e) => {
      console.log(`Websocket Closed, ${e.code} ${e.reason}`);
      // show an error message
    };
    webSocket.current.onerror = (e) => {
      throw new Error("Can't connect " + e);
    };
  };

  const joinRoom = () => {
    if (isJoin) {
      sendSignal("leave", {
        id: userId,
      });
    } else {
      connectWs();
    }
    setIsJoin(!isJoin);
  };

  const sendSignal = (action, message) => {
    webSocket.current.send(
      JSON.stringify({
        peer: userId.current,
        action: action,
        message: message,
      })
    );
  };

  const sendMesage = () => {
    if (!message) {
      return;
    }
    sendSignal("chat", {
      message: userId.current + ":" + message,
    });
    setMessage(null);
  };

  return (
    <View style={[styles.flex, styles.rootContainer]}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.flex, styles.rootContainer]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.flex, styles.borderedContainer]}>
            {/* {
                            remoteStreams?.size ? (
                                [...remoteStreams].map(([userId, stream]) => {
                                    <RTCView
                                        objectFit={'cover'}
                                        style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                                        streamURL={stream.toURL()}
                                    />
                                })
                            ) : null
                        } */}

            <>
              {remoteDisplayStream ? (
                <>
                  <Text>Remote display stream</Text>
                  <RTCView
                    objectFit={"cover"}
                    style={{ flex: 1, backgroundColor: "#050A0E", height: 50 }}
                    streamURL={remoteDisplayStream.toURL()}
                  />
                </>
              ) : null}
            </>
            <>
              {remoteStream ? (
                <>
                  <Text>Remote stream</Text>
                  <RTCView
                    objectFit={"cover"}
                    style={{
                      flex: 1,
                      backgroundColor: "#050A0E",
                      height: 50,
                    }}
                    streamURL={remoteStream.toURL()}
                  />
                </>
              ) : null}
            </>
          </View>

          {!isJoin ? (
            <View style={styles.shrinkingContainer}>
              <Button onPress={joinRoom} title="join" />
            </View>
          ) : (
            <>
              {mapPeers.current ? (
                <>
                  <Text style={styles.label}>Chat</Text>
                  <TextInput
                    onChangeText={(msg) => setMessage(msg)}
                    placeholder={"message"}
                    // onSubmitEditing={this.joinOrLeaveRoom}
                    // returnKeyType={'join'}
                    value={message}
                    style={{ flexGrow: 1 }}
                  />
                  <Button onPress={sendMesage} title="Send"></Button>
                </>
              ) : null}
              <View>
                <Button
                  onPress={toggleAudio}
                  title={audioEnabled ? "Mute  Audio" : "Unmute  Audio"}
                ></Button>

                <Button
                  onPress={toggleVideo}
                  title={videoEnabled ? "Stop Video" : "Start Video"}
                ></Button>

                <Button
                  onPress={toggleShareScreen}
                  title={
                    isShareScreen ? " Stop Screen Share" : "Start Screen Share"
                  }
                ></Button>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export default Demo8;
