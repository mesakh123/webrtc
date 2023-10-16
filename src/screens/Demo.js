import React from 'react';
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

const userTypeData = [
  { label: 'streamer', value: 'streamer' },
  { label: 'viewer', value: 'viewer' },
];
class Demo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      roomInput: '1',
      joinedRoom: null,
      alertText: null,
      videoDevices: [],
      peers: new Map(),
      streams: new Map(),
      earlyCandidates: new Map(),
      wsSessionId: null,
      isFront: false,

      userType: null,
      userId: null,
      isFocus: false,

      message: null,


      selfViewSrc: null,
      selfViewSrcKey: null,
      localStream: new MediaStream(),
      localDisplayStream: new MediaStream(),

      audioTracks: null,
      videoTracks: null,
      screenShared:false,

    };
    window.component = this;
  }

  componentDidMount() {
    // this.connectWs();
  }

  connectWs = () => {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.setState({ alertText: null });
    }
    // const wsEndpoint = 'ws://localhost:8088';
    const wsEndpoint = 'wss://mango-live.website/ws/live-room/';
    // eslint-disable-next-line no-undef
    this.ws = new WebSocket(wsEndpoint);

    this.ws.onopen = () => {
      console.log('WebSocket Client Connected');
      this.setState({ alertText: null });

      // notify other peers
      this.sendSignal(type, {
        'local_screen_sharing': false,
        "room_id": this.state.roomId, //TODO: fixme
        "dest_user_id": null, //TODO: fixme
        "src_user_id": this.state.userId //TODO: fixme
      });
    };
    this.ws.onmessage = (e) => {
      this.handleMessage(JSON.parse(e.data));
    };
    this.ws.onclose = (e) => {
      console.log(`Websocket Closed, ${e.code} ${e.reason}`);
      // show an error message
      this.setState({
        alertText:
          'Websocket is closed ' + wsEndpoint + ', is the backend started? Tap here to try reconnecting.',
      });
    };
  };

  sendMessage = (message) => {
    message.sessionId = this.state.wsSessionId;
    this.ws.send(JSON.stringify(message));
  };

  sendSignal = (action, data) => {
    this.ws.send(JSON.stringify(
      {
        'action': action,
        'data': data,
      }
    ));
  };

  joinOrLeaveRoom = () => {
    // leave the room if already in one
    if (this.state.joinedRoom) {
      // this.sendMessage({ action: 'leave', room: this.state.joinedRoom });

      [...this.state.peers.keys()].forEach(async (key) => {
        try {
          await this.closePeer(key);
        } catch (e) {
          console.warn(`Error closing peer ${key}`);
        }
      });
      this.setState({ joinedRoom: null, room: '' });
      return;
    }


    var current_action = "streamer_join_room";
    if (this.state.userType == "viewer") {
      current_action = "viewer_join_room";
    }
    const roomInputValue = this.state.roomInput;
    // alert that the room name is required
    if (roomInputValue.length === 0) {
      Alert.alert('Room Name is required.');
      return;
    }

    // actually join the room if the above checks pass
    this.setState({ joinedRoom: roomInputValue }, () => {

      this.sendSignal(current_action, {
        'local_screen_sharing': false,
        "room_id": this.state.joinedRoom, //TODO: fixme
        "src_user_id": this.state.userId //TODO: fixme
      })

    });

    this.connectWs();
  };
  handleMessage = async (event) => {
    try {
      var parsedData = JSON.parse(event.data)["data"]
      var localScreenSharing = parsedData.remote_screen_sharing;
      var src_user_id = parsedData.src_user_id;
      var dest_user_id = parsedData.dest_user_id;
      var parsed_room_id = parsedData.room_id;

      if (parsed_room_id != roomId) {

        return;
      }

      try {
        if (parsedData.success == false && this.state.userId == dest_user_id) {
          throw new Error(parsedData.message);
        }
      }
      catch (e) {
        Alert.alert("Websocket error : " + e);
        if (action == "viewer_join_room") {
          this.ws.dispatchEvent(new Event("error", { error: e }));
          return
        }
      }

      if (dest_user_id && dest_user_id != this.state.userId) {
        console.log("current user id :", this.state.userId);
        console.log("dest user id :", dest_user_id);
        // ignore all messages from oneself
        return;
      }

      switch (message.action) {
        case 'viewer_join_room':
          console.log(`User ${sessionId} joined room`);
          // when another user joins, create an RTCPeerConnection and send them an SDP offer
          await this.createOfferer(src_user_id, dest_user_id, false, remoteScreenSharing, receiver_channel_name);
          if (this.state.screenShared && !remoteScreenSharing) {
            // if local screen is being shared
            // and remote peer is not sharing screen
            // send offer from screen sharing peer
            console.log('Creating screen sharing offer.');
            await this.createOfferer(src_user_id, dest_user_id, false, remoteScreenSharing, receiver_channel_name);
          }
          break;
        case 'new-offer':
          console.log(`SDP Offer received from ${sessionId}`);
          // when another user sends an SDP offer, replay with an SDP Answer

          // create new RTCPeerConnection
          // set offer as remote description
          var offer = parsedData.sdp;
          await this.createAnswerer(offer, src_user_id, dest_user_id, localScreenSharing, remoteScreenSharing, receiver_channel_name);

          break;
        case 'new-answer':
          // in case of answer to previous offer
          // get the corresponding RTCPeerConnection
          var peer = null;

          if (remoteScreenSharing) {
            // if answerer is screen sharer
            peer = mapPeers[src_user_id + ' Screen'][0];
          } else if (localScreenSharing) {
            // if offerer was screen sharer
            peer = mapScreenPeers[src_user_id][0];
          } else {
            // if both are non-screen sharers
            peer = mapPeers[src_user_id][0];
          }

          // get the answer
          var answer = parsedData['sdp'];

          console.log('mapPeers:');
          for (key in mapPeers) {
            console.log(key, ': ', mapPeers[key]);
          }

          console.log('peer: ', peer);
          console.log('answer: ', answer);

          // set remote description of the RTCPeerConnection
          peer.setRemoteDescription(answer);

          break;
        case "chat":
          if (this.state.userId == src_user_id) {
            return;
          }
          var nodeText = parsedData.username + ": " + parsedData.message

        default:
          console.warn(`Unrecognized method: ${message.action}`);
      }
    } catch (e) {
      console.warn('Error handling message');
      console.warn(e);
    }
  };



  closePeer = async (sessionId) => {
    console.log('closePeer');
    const peer = this.state.peers.get(sessionId);
    if (peer) {
      peer.close();
    }
    const peers = this.state.peers;
    peers.delete(sessionId);

    await this.setState({
      peers: new Map(peers),
    });
    await this.removeVideo(sessionId);
  };

  setupVideoDeviceList = async () => {
    const videoDevices = [...(await mediaDevices.enumerateDevices())].filter(
      (sourceInfo) =>
        sourceInfo.kind === 'videoinput' || sourceInfo.kind === 'video',
    );
    this.setState({ videoDevices });
  };

  // sets up the local media stream
  showLocalVideo = async ({ deviceId = undefined }) => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          // width: 640,
          // height: 480,
          // frameRate: 30,
          // facingMode: this.state.isFront ? 'user' : 'environment',
          deviceId,
        },
      }).then(
        stream=>{
          this.setState({localStream:stream});
          var audioTracks = stream.getAudioTracks();
          var videoTracks = stream.getVideoTracks();
          this.setState({
            audioTracks:audioTracks,
            videoTracks:videoTracks
          })
          console.log("audiotracks : ",this.audioTracks);
          console.log("videoTracks : ",this.videoTracks);
          // unmute audio and video by default
          audioTracks[0].enabled = true;
          videoTracks[0].enabled = true;

        }
      );
      this.setState({ deviceId });
      await this.setupVideoDeviceList();
      await this.addVideo(this.state.wsSessionId, stream);
    } catch (err) {
      console.log('Error getting media permissions');
      console.warn(err);
      this.setState({ alertText: `${err}` });
    }
  };

  // releases local media stream's tracks and removes the video from the page
  releaseLocalVideo = async () => {
    await this.removeVideo(this.state.wsSessionId);
  };

  addVideo = async (sessionId, stream) => {
    await this.setState({
      streams: new Map(this.state.streams.set(sessionId, stream)),
    });
  };

  removeVideo = async (sessionId) => {
    const streams = this.state.streams;
    const stream = streams.get(sessionId);
    if (stream) {
      stream.release();
    }
    streams.delete(sessionId);
    await this.setState({ streams: new Map(streams) });
  };

  roomInputChange = (roomInput) => this.setState({ roomInput });
  userIdInputChange = (userId) => this.setState({ userId })
  chatInputChange = (message) => this.setState({ message });

  addLocalTracks = (peer, localScreenSharing) => {
    if (!localScreenSharing) {
      // if it is not a screen sharing peer
      // add user media tracks
      this.state.localStream.getTracks().forEach(track => {
        console.log('Adding localStream tracks.');
        peer.addTrack(track, this.state.localStream);
      });

      return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    this.state.localDisplayStream.getTracks().forEach(track => {
      console.log('Adding localDisplayStream tracks.');
      peer.addTrack(track, this.state.localDisplayStream);
    });
  }


  // create RTCPeerConnection as offerer
  // and store it and its datachannel
  // send sdp to remote peer after gathering is complete
  createOfferer = async (srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
    var peer = new RTCPeerConnection({
      iceServers: [
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
    this.addLocalTracks(peer, localScreenSharing);

    // create and manage an RTCDataChannel
    var dc = peer.createDataChannel("channel");
    dc.onopen = () => {
      console.log("Connection opened.");
    };
    if (!localScreenSharing && !remoteScreenSharing) {
      // none of the peers are sharing screen (normal operation)

      dc.onmessage = this.dcOnMessage;


      // store the RTCPeerConnection
      // and the corresponding RTCDataChannel
      mapPeers[srcPeerUserId] = [peer, dc];

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          console.log('Deleting peer');
          delete mapPeers[srcPeerUserId];
          if (iceConnectionState != 'closed') {
            peer.close();
          }
          // removeVideo(remoteVideo);
        }
      };
    } else if (!localScreenSharing && remoteScreenSharing) {
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
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          delete mapPeers[peerUserId + ' Screen'];
          if (iceConnectionState != 'closed') {
            peer.close();
          }
          // removeVideo(remoteVideo);
        }
      };
    } else {
      // offerer itself is sharing screen

      dc.onmessage = (e) => {
        console.log('New message from %s: ', srcPeerUserId, e.data);
      };

      mapScreenPeers[srcPeerUserId] = [peer, dc];

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          delete mapScreenPeers[srcPeerUserId];
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
      this.sendSignal('new-offer', {
        'sdp': peer.localDescription,
        'receiver_channel_name': receiver_channel_name,
        'local_screen_sharing': localScreenSharing,
        'remote_screen_sharing': remoteScreenSharing,
        "room_id": roomId,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
      });
    }

    peer.createOffer()
      .then(o => peer.setLocalDescription(o))
      .then(function (event) {
        console.log("Local Description Set successfully.");
      });

    console.log('mapPeers[', srcPeerUserId, ']: ', mapPeers[srcPeerUserId]);

    return peer;
  }

  dcOnMessage = (event) => {
    var message = event.data;


  }
  // create RTCPeerConnection as answerer
  // and store it and its datachannel
  // send sdp to remote peer after gathering is complete
  createAnswerer = async (offer, srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
    var peer = new RTCPeerConnection({
      iceServers: [
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


    this.addLocalTracks(peer, localScreenSharing);
    console.log("localScreenSharing", localScreenSharing)
    console.log("remoteScreenSharing", remoteScreenSharing)
    if (!localScreenSharing && !remoteScreenSharing) {
      // if none are sharing screens (normal operation)

      // set remote video
      var remoteVideo = this.createVideo(srcPeerUserId);

      // and add tracks to remote video
      setOnTrack(peer, remoteVideo);

      // it will have an RTCDataChannel
      peer.ondatachannel = e => {
        console.log('e.channel.label: ', e.channel.label);
        peer.dc = e.channel;
        peer.dc.onmessage = this.dcOnMessage;
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
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          delete mapPeers[srcPeerUserId];
          if (iceConnectionState != 'closed') {
            peer.close();
          }
          //removeVideo(remoteVideo);
        }
      };
    } else if (localScreenSharing && !remoteScreenSharing) {
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
          if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            delete mapScreenPeers[srcPeerUserId];
            if (iceConnectionState != 'closed') {
              peer.close();
            }
          }
        };
      }
    } else {
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
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          delete mapPeers[srcPeerUserId + ' Screen'];
          if (iceConnectionState != 'closed') {
            peer.close();
          }
          //removeVideo(remoteVideo);
        }
      };
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
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
      this.sendSignal('new-answer', {
        'sdp': peer.localDescription,
        'receiver_channel_name': receiver_channel_name,
        'local_screen_sharing': localScreenSharing,
        'remote_screen_sharing': remoteScreenSharing,
        "room_id": roomId,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
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





  render() {
    const isActiveStreamer = this.state.streams.has(this.state.wsSessionId);
    return (
      <View style={[styles.flex, styles.rootContainer]}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={[styles.flex, styles.rootContainer]}>
          <Text style={styles.label}>WebRTC Demo</Text>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.flex, styles.borderedContainer]}>
              <Text style={styles.label}>Video</Text>
              {this.state.alertText && (
                <TouchableOpacity onPress={this.connectWs}>
                  <Text style={styles.alertLabel}>{this.state.alertText}</Text>
                </TouchableOpacity>
              )}
              {[...this.state.streams.keys()].map((k) => (
                <View key={k} style={styles.flex}>
                  <RTCView
                    key={k}
                    stream={this.state.streams.get(k)}
                    objectFit="contain"
                    style={styles.flex}
                  />
                  <Text style={styles.streamLabel}>{k}</Text>
                </View>
              ))}
            </View>

            <View style={styles.shrinkingChildContainer}>

              <Text style={styles.label}>
                Chat
              </Text>
              {!this.state.joinedRoom && (
                <TextInput
                  onChangeText={this.chatInputChange}
                  placeholder={'message'}
                  // onSubmitEditing={this.joinOrLeaveRoom}
                  // returnKeyType={'join'}
                  value={this.state.message}
                  style={{ flexGrow: 1 }}
                />
              )}
              <Button
                onPress={() => {
                  let currentMessage = this.state.message;
                  // send offer to new peer
                  // after ice candidate gathering is complete
                  this.sendSignal('chat', {
                    "room_id": this.state.roomInput,
                    "src_user_id": this.state.userId,
                    "message": currentMessage,
                  });
                  this.setState({ message: null });

                }}
                title='Send'
              >
              </Button>
            </View>

            <View style={styles.shrinkingContainer}>
              <View>
                <Text style={styles.label}>
                  Room Name
                  {this.state.joinedRoom && `: ${this.state.joinedRoom}`}
                </Text>
                {!this.state.joinedRoom && (
                  <TextInput
                    onChangeText={this.roomInputChange}
                    placeholder={'Room Name'}
                    testID={'roomInput'}
                    // onSubmitEditing={this.joinOrLeaveRoom}
                    // returnKeyType={'join'}
                    value={this.state.roomInput}
                    style={styles.roomInput}
                  />
                )}
              </View>
            </View>
            <View style={styles.shrinkingContainer}>
              <View>
                <Text style={styles.label}>
                  User ID
                  {this.state.joinedRoom && `: ${this.state.userId}`}
                </Text>
                {!this.state.joinedRoom && (
                  <TextInput
                    onChangeText={this.userIdInputChange}
                    placeholder={'User ID'}
                    // onSubmitEditing={this.joinOrLeaveRoom}
                    // returnKeyType={'join'}
                    value={this.state.userId}
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
                  value={this.state.userType}
                  onChange={item => {
                    this.setState({ userType: item.value })
                  }}
                  renderLeftIcon={() => (
                    <AntDesign
                      style={styles.icon}
                      color='blue'
                      name="Safety"
                      size={20}
                    />
                  )}
                  disable={this.state.joinedRoom}

                />
              </View>
            </View>

            <View style={styles.shrinkingContainer}>
              <View>
                <RoundedButton
                  text={this.state.joinedRoom ? 'Leave Room' : 'Join Room'}
                  onPress={this.joinOrLeaveRoom}
                  testID={
                    this.state.joinedRoom ? 'leaveRoomButton' : 'joinRoomButton'
                  }
                />
                {!this.state.joinedRoom && (
                  <>
                    <View style={styles.flexRow}>
                      <RoundedButton
                        style={styles.greenButton}
                        text={isActiveStreamer ? 'Revoke Media' : 'Grant Media'}
                        onPress={
                          isActiveStreamer
                            ? this.releaseLocalVideo
                            : this.showLocalVideo
                        }
                        testID={
                          isActiveStreamer
                            ? 'revokeMediaAccessRoomButton'
                            : 'grantMediaAccessRoomButton'
                        }
                      />
                    </View>
                    <View style={styles.flexRow}>
                      {this.state.videoDevices.map((device, index) => (
                        <RoundedButton
                          key={index}
                          onPress={() => this.showLocalVideo(device)}
                          style={styles.greenButton}
                          text={device.label || `Device ${index}`}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }
}
export default Demo;