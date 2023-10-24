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

function Demo7() {
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
      console.log("Add local tracks");
      peer.addStream(localStream);
      localStream.getTracks().forEach((track) => {
        console.log("Adding localStream tracks.");
        peer.getLocalStreams()[0].addTrack(track);
      });
      return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    console.log("addLocalTracks localStream", localStream);
    console.log(
      "addLocalTracks localDisplayStream",
      localDisplayStream.current
    );
    peer.addStream(localDisplayStream.current);
    localDisplayStream.current.getTracks().forEach((track) => {
      console.log("Adding localStream tracks.");
      peer.getLocalStreams()[0].addTrack(track);
    });
    console.log("addLocalTracks localDisplayStream finished");
  };
  const OFFERICESERVERS = [
    {
      urls: "turn:194.5.157.135:3478",
      username: "admin",
      credential: "Asdf#45214521",
    },
  ];

  const ANSWERICESERVERS = [
    {
      urls: "turn:194.5.157.135:3478",
      username: "admin",
      credential: "Asdf#45214521",
    },
  ];
  useEffect(() => {
    // Get local media stream
    connectDevices();
  }, []);

  const mappingOfferPeerConnection = (
    srcPeerUserId,
    localScreenSharing,
    remoteScreenSharing,
    peerConnection,
    dataChannel
  ) => {
    var currentMapPeers = null;

    if (!localScreenSharing && !remoteScreenSharing) {
      dataChannel.onmessage = dcOnMessage;
      setOnTrack(peerConnection, srcPeerUserId, false);
      currentMapPeers = mapPeers.current;
      currentMapPeers = currentMapPeers.set(srcPeerUserId, [
        peerConnection,
        dataChannel,
      ]);
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          console.log("Deleting peer ", peerConnection);
          currentMapPeers.delete(srcPeerUserId);
          console.log("currentmappeers delete");
          if (iceConnectionState != "closed") {
            peerConnection.close();
          }

          if (
            remoteStreams.current.len > 0 &&
            remoteStreams.current.has(srcPeerUserId)
          ) {
            var newRemoteStreams = new Map(remoteStreams.current);
            newRemoteStreams = newRemoteStreams.delete(srcPeerUserId);
            remoteStreams.current = newRemoteStreams;
          }
        }
      };
      mapPeers.current = new Map(currentMapPeers);
    } else if (!localScreenSharing && remoteScreenSharing) {
      // answerer is screen sharing

      var newMapPeersKey = srcPeerUserId + " Screen";
      currentMapPeers = mapPeers.current.set(newMapPeersKey, [
        peerConnection,
        dataChannel,
      ]);
      var newSrcPeerUserId = srcPeerUserId + "-screen";
      setOnTrack(peerConnection, newSrcPeerUserId, true);
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          currentMapPeers.delete(newMapPeersKey);
          if (iceConnectionState != "closed") {
            peerConnection.close();
          }

          var newRemoteStreams = new Map(remoteStreams.current);
          newRemoteStreams = newRemoteStreams.delete(newSrcPeerUserId);
          remoteStreams.current = newRemoteStreams;
        }
      };
      mapPeers.current = new Map(currentMapPeers);
    } else {
      currentMapPeers = mapScreenPeers.current.set(srcPeerUserId, [
        peerConnection,
        dataChannel,
      ]);

      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          currentMapPeers.delete(srcPeerUserId);
          if (iceConnectionState != "closed") {
            peerConnection.close();
          }

          var newRemoteStreams = new Map(remoteStreams.current);
          newRemoteStreams = newRemoteStreams.delete(srcPeerUserId);
          remoteStreams.current = newRemoteStreams;
        }
      };
      mapScreenPeers.current = new Map(currentMapPeers);
    }
  };

  const dcOnMessage = (event) => {
    var message = event.data;
    Alert.alert(srcPeerUserId, message);
  };

  const createOffer = async (
    peerUserId,
    localScreenSharing,
    remoteScreenSharing,
    receiver_channel_name
  ) => {
    // Create RTCPeerConnection
    const peerConnection = new RTCPeerConnection({
      iceservers: OFFERICESERVERS,
      iceCandidatePoolSize: 10,
    });

    addLocalTracks(peerConnection, localScreenSharing);
    var dataChannel = peerConnection.createDataChannel("channel");
    dataChannel.onopen = () => {
      console.log("Connection opened.");
    };
    mappingOfferPeerConnection(
      peerUserId,
      localScreenSharing,
      remoteScreenSharing,
      peerConnection,
      dataChannel
    );

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        return;
      }
      sendSignal("new-offer", {
        sdp: peerConnection.localDescription,
        receiver_channel_name: receiver_channel_name,
        local_screen_sharing: localScreenSharing,
        remote_screen_sharing: remoteScreenSharing,
      });
    };

    // Create and send offer
    peerConnection
      .createOffer()
      .then((offer) => peerConnection.setLocalDescription(offer))
      .then(function (event) {
        console.log("Local Description Set successfully.");
      });
  };
  const setOnTrack = async (peer, srcPeerUserId, isRemoteDisplayStream) => {
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

    peer.onaddstream = (event) => {
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

  const mappingAnswerPeerConnection = (
    srcPeerUserId,
    localScreenSharing,
    remoteScreenSharing,
    peerConnection
  ) => {
    console.log("Start mapping answer");
    if (!localScreenSharing && !remoteScreenSharing) {
      // if none are sharing screens (normal operation)

      // it will have an RTCDataChannel
      var currentMapPeers = mapPeers.current;
      setOnTrack(peerConnection, srcPeerUserId, false);
      peerConnection.ondatachannel = (e) => {
        console.log("e.channel.label: ", e.channel.label);
        console.log("remoteStreams", remoteStreams.current);
        peerConnection.dc = e.channel;

        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(srcPeerUserId, [
          peerConnection,
          peerConnection.dc,
        ]);
      };

      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          currentMapPeers.delete(srcPeerUserId);
          if (iceConnectionState != "closed") {
            peerConnection.close();
          }
          remoteStreams.current.delete(srcPeerUserId);
        }
      };
      mapPeers.current = new Map(currentMapPeers);
    } else if (localScreenSharing && !remoteScreenSharing) {
      // answerer itself is sharing screen

      var currentMapPeers = mapScreenPeers.current;
      // it will have an RTCDataChannel
      peerConnection.ondatachannel = (e) => {
        peerConnection.dc = e.channel;
        // this peer is a screen sharer
        // so its connections will be stored in mapScreenPeers
        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(srcPeerUserId, [
          peerConnection,
          peerConnection.dc,
        ]);

        peerConnection.oniceconnectionstatechange = () => {
          var iceConnectionState = peerConnection.iceConnectionState;
          if (
            iceConnectionState === "failed" ||
            iceConnectionState === "disconnected" ||
            iceConnectionState === "closed"
          ) {
            currentMapPeers.delete(srcPeerUserId);
            if (iceConnectionState != "closed") {
              peerConnection.close();
            }
          }
        };
      };
      mapScreenPeers.current = new Map(currentMapPeers);
    } else {
      // offerer is sharing screen
      var newMapPeersKey = srcPeerUserId + " Screen";
      var currentMapPeers = mapPeers.current;
      var newSrcPeerUserId = srcPeerUserId + "-screen";
      setOnTrack(peerConnection, newSrcPeerUserId, true);
      // it will have an RTCDataChannel
      peerConnection.ondatachannel = (e) => {
        peerConnection.dc = e.channel;
        peerConnection.dc.onmessage = (evt) => {
          console.log(
            "New message from %s's screen: ",
            newMapPeersKey,
            evt.data
          );
        };
        peerConnection.dc.onopen = () => {
          console.log("Connection opened.");
        };

        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        currentMapPeers = currentMapPeers.set(newMapPeersKey, [
          peerConnection,
          peerConnection.dc,
        ]);
      };
      peerConnection.oniceconnectionstatechange = () => {
        var iceConnectionState = peerConnection.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          currentMapPeers.delete(newMapPeersKey);
          if (iceConnectionState != "closed") {
            peerConnection.close();
          }

          var newRemoteStreams = new Map(remoteStreams.current);
          newRemoteStreams = newRemoteStreams.delete(newSrcPeerUserId);
          remoteStreams.current = newRemoteStreams;
        }
      };
      mapPeers.current = new Map(currentMapPeers);
    }
  };
  const createAnswer = async (
    offer,
    peerUserId,
    localScreenSharing,
    remoteScreenSharing,
    receiver_channel_name
  ) => {
    // Create RTCPeerConnection
    const peerConnection = new RTCPeerConnection({
      iceservers: ANSWERICESERVERS,

      iceCandidatePoolSize: 10,
    });
    // Add local media stream to RTCPeerConnection
    addLocalTracks(peerConnection, localScreenSharing);

    mappingAnswerPeerConnection(
      peerUserId,
      localScreenSharing,
      remoteScreenSharing,
      peerConnection
    );

    // Handle incoming ICE candidates
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        // socket.emit("ice candidate", e.candidate, id);
        return;
      }
      sendSignal("new-answer", {
        sdp: peerConnection.localDescription,
        receiver_channel_name: receiver_channel_name,
        local_screen_sharing: localScreenSharing,
        remote_screen_sharing: remoteScreenSharing,
      });
    };

    // Set remote description and create and send answer
    peerConnection
      .setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        console.log("Set offer from %s.", peerUserId);
        return peerConnection.createAnswer();
      })
      .then((a) => {
        return peerConnection.setLocalDescription(a);
      })
      .catch((error) => {
        console.log("Error creating answer for %s.", peerUserId);
        console.log(error);
      });
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
    if (remoteScreenSharing) {
      // if answerer is screen sharer
      peerKey = src_user_id + " Screen";
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    } else if (localScreenSharing) {
      currentMapPeers = mapScreenPeers.current;
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    } else {
      currentPeerConnection = currentMapPeers.get(peerKey)[0];
    }
    // set remote description of the RTCPeerConnection
    currentPeerConnection.setRemoteDescription(sdp);
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

    var remoteScreenSharing = parsedData.message.local_screen_sharing;
    var localScreenSharing = parsedData.message.remote_screen_sharing;
    var receiver_channel_name = parsedData.message.receiver_channel_name;
    var action = parsedData.action;

    if (action == "new-peer") {
      console.log(
        "Create new offer for user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
      );
      createOffer(
        peerUserId,
        false,
        remoteScreenSharing,
        receiver_channel_name
      );
      if (isShareScreen && !remoteScreenSharing) {
        createOffer(
          peerUserId,
          true,
          remoteScreenSharing,
          receiver_channel_name
        );
      }
      return;
    } else if (action == "new-offer") {
      var offer = parsedData.message.sdp;
      console.log(
        "Create new answer for user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
      );
      createAnswer(
        offer,
        peerUserId,
        localScreenSharing,
        remoteScreenSharing,
        receiver_channel_name
      );
      return;
    } else if (action == "new-answer") {
      console.log(
        "Receive new answer from user " +
          peerUserId +
          "with receiver_channel_name" +
          receiver_channel_name
      );

      receiveNewAnswer(
        parsedData.message.sdp,
        peerUserId,
        localScreenSharing,
        remoteScreenSharing
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
              ) : (
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
              )}
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

export default Demo7;
