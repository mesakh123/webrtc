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

  const addLocalTracks = (peer, localScreenSharing) => {
    if (!localScreenSharing) {
      // if it is not a screen sharing peer
      // add user media tracks
      peer.addStream(localStream);
      localStream.getTracks().forEach((track) => {
        console.log("Adding localStream tracks.");
        peer.getLocalStreams()[0].addTrack(track);
      });
      return;
    }
    peer.addStream(localDisplayStream.current);
    localDisplayStream.current.getTracks().forEach((track) => {
      console.log("Adding localDisplayStream tracks.");
      peer.getLocalStreams()[0].addTrack(track);
    });
  };

  useEffect(() => {
    // Get local media stream
    connectDevices();
  }, []);

  const setICEConnectionStateChange = (
    peerConnection,
    srcPeerUserId,
    currentMapPeers
  ) => {
    peerConnection.oniceconnectionstatechange = () => {
      var iceConnectionState = peerConnection.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        if (iceConnectionState !== "closed") {
          peerConnection.close();
          console.log("Deleting peer ", peerConnection);
          currentMapPeers.delete(srcPeerUserId);
          console.log("currentmappeers delete");
        }
      }
    };
  };

  const dcOnMessage = (event) => {
    var message = event.data;
    Alert.alert(srcPeerUserId, message);
  };

  const setOnIceCandidate = (
    peerConnection,
    receiver_channel_name,
    isScreen
  ) => {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE Candidate", event.candidate);
        sendSignal("ICECandidate", {
          ice_candidate: event.candidate,
          receiver_channel_name: receiver_channel_name,
          is_screen: isScreen,
        });
      } else {
        console.log("All ICE candidates have been sent!!");
      }
    };
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
      console.log("set track is remote display stream");
      setRemoteDisplayStream(mediaStream);
    } else {
      console.log("set track is remote stream");
      setRemoteStream(mediaStream);
    }
    peer.ontrack = (event) => {
      console.log("Adding track: ", event.track);
      mediaStream.addTrack(event.track, mediaStream);
    };

    peer.onaddstream = async (event) => {
      remoteStreams.current.set(srcPeerUserId, event.stream);
      if (isRemoteDisplayStream) {
        console.log("share screen event stream", event.stream);
        setRemoteDisplayStream(event.stream);
      } else {
        console.log("share video event stream", event.stream);
        setRemoteStream(event.stream);
      }

      console.log("Adding event stream");
    };
  };

  const connectDevices = () => {
    console.log("Get local media");
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
    { url: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:freeturn.net:3478",
      username: "free",
      credential: "free",
    },
  ];
  //Configuration of STUN AND TURN Servers
  const configuration = {
    iceServers: iceServers,
  };

  const addMediaTracks = (peerConnection, localStream) => {
    peerConnection.addStream(localStream);
    localStream.getTracks().forEach((track) => {
      peerConnection.getLocalStreams()[0].addTrack(track);
    });
  };
  //Trickle ICE (Send ICE Candidates to remote peer)
  function setIceCandidateEvent(peerConnection, receiver_channel_name) {
    //Setting onicecandidate
    //Listen for local ICE candidates on the local RTCPeerConnection
    //Send IceCandidates to peer
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(
          "Sending ICE Candidate",
          event.candidate,
          receiver_channel_name
        );
        sendSignal("ICECandidate", {
          ice_candidate: event.candidate,
          receiver_channel_name: receiver_channel_name,
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

    addMediaTracks(peerConnection, localStream);

    //Set the onicecandidate event
    setIceCandidateEvent(peerConnection, receiver_channel_name);

    //Create video element for remote Peer
    setRemoteTracks(peerConnection, peerUserId);

    //set the oniceconnectionstatechange event
    setICEConnectionStateChange(peerConnection, peerUserId, mapPeers.current);

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

  const CreateAnswerRTCPeerConnection = (
    offer,
    peerUserId,
    receiver_channel_name,
    localScreenSharing,
    remoteScreenSharing
  ) => {
    const peerConnection = new RTCPeerConnection(configuration);

    addMediaTracks(peerConnection, localStream);

    //Set the onicecandidate event
    setIceCandidateEvent(peerConnection, receiver_channel_name);

    //Create video element for remote Peer
    setRemoteTracks(peerConnection, peerUserId);

    //set the oniceconnectionstatechange event
    setICEConnectionStateChange(peerConnection, peerUserId, mapPeers.current);

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

  const receiveICECandidates = async (peerUserId,ice_candidate, is_screen) => {
    if (!ice_candidate) {
      console.log("ICE candidate is empty");
      return;
    }
    try {
      if (is_screen) {
        console.log("IS screen ", mapScreenPeers.current.has(peerUserId));
        mapScreenPeers.get(peerUserId).addIceCandidate(ice_candidate);
      } else {
        console.log("IS not screen ", mapPeers.current.has(peerUserId));
        mapPeers.current.get(peerUserId).addIceCandidate(ice_candidate);
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
    if (action == "ICECandidate" && mapPeers.current.has(peerUserId)) {
      let ice_candidate = parsedData.message.ice_candidate;
      let is_screen = parsedData.message.is_screen;
      receiveICECandidates(peerUserId,ice_candidate, is_screen);
      return;
    }

    var remoteScreenSharing = parsedData.message.local_screen_sharing;
    var localScreenSharing = parsedData.message.remote_screen_sharing;
    var receiver_channel_name = parsedData.message.receiver_channel_name;

    if (action == "new-peer") {
      console.log(
        "Create new offer for user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
      );
      var peerConnection = CreateOfferRTCPeerConnection(
        peerUserId,
        false,
        remoteScreenSharing,
        receiver_channel_name
      );
      if (isShareScreen && !remoteScreenSharing) {
        var pc = CreateOfferRTCPeerConnection(
          peerUserId,
          true,
          remoteScreenSharing,
          receiver_channel_name
        );
      }

      mapPeers.current.set(peerUserId, peerConnection);
      console.log(
        `Current ${userId.current} mapping user ${peerUserId} in map peers (new-peer)`
      );
      return;
    } else if (action == "new-offer") {
      var offer = parsedData.message.sdp;
      console.log(
        "Create new answer for user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
      );
      var peerConnection = CreateAnswerRTCPeerConnection(
        offer,
        peerUserId,
        receiver_channel_name,
        localScreenSharing,
        remoteScreenSharing
      );
      mapPeers.current.set(peerUserId, peerConnection);
      console.log(
        `Current ${userId.current} mapping user ${peerUserId} in map peers (new-offer)`
      );
      return;
    } else if (action == "new-answer" && mapPeers.current.has(peerUserId)) {
      var peerConnection = mapPeers.current.get(peerUserId);
      console.log(
        "Receive new answer from user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
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
      await stopForeGroundService();
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
    setIsShareScreen(!isShareScreen);
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
    console.log("Websocket.current", webSocket.current);
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
