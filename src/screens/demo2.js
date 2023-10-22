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
  NativeEventEmitter,
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
      mapPeers: new Map(),
      mapScreenPeers: new Map(),
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
      remoteStream: null,
      remoteUserId:null,

      audioTracks: null,
      videoTracks: null,
      screenShared: false,
      localWebcamOn: false,

    };
    window.component = this;
  }

  connectDevices = () => {
    const peer = this.state.peer;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == 'videoinput' &&
          sourceInfo.facing == (this.state.isFront ? 'user' : 'environment')
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
            facingMode: this.state.isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
          },
        })
        .then(stream => {
          // Got stream!

          this.setState({ localStream: stream });
          // setup stream listening
          peer.addStream(stream);
        })
        .catch(error => {
          // Log error
        });
    });
    this.setState({ peer: peer });

  }


  setRTPConnection = () =>{
    this.setState({
      peer: new RTCPeerConnection({
        iceServers: [
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
      })
    });
  }

  componentDidMount() {
    this.setRTPConnection();
    this.connectDevices();
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
    console.log("Prepare to connect ...");
    console.log("UserType ", this.state.userType)
    if(!this.state.peer){
      this.setRTPConnection();
    }
    this.ws = new WebSocket(wsEndpoint);

    this.ws.onopen = () => {
      console.log('WebSocket Client Connected');
      this.setState({ alertText: null });

      // notify other peers

      var action = this.state.userType == "streamer" ? "streamer_join_room" : "viewer_join_room";

      console.log("action : ", action);
      console.log("roomInput : ", this.state.roomInput)
      this.sendSignal(action, {
        'local_screen_sharing': false,
        "room_id": this.state.roomInput, //TODO: fixme
        "dest_user_id": this.state.userId, //TODO: fixme
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
    this.ws.onerror = (e) => {
      this.setState({ joinedRoom: null });
      throw new Error("Can't connect " + e);
    }
    this.setState({ joinedRoom: this.state.roomInput, wsSessionId: null });


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


      [...this.state.mapPeers.keys()].forEach(async (key) => {
        try {
          await this.closePeer(key);
        } catch (e) {
          console.warn(`Error closing peer ${key} : ${e}`);
        }
      });

      [...this.state.mapScreenPeers.keys()].forEach(async (key) => {
        try {
          await this.closePeer(key);
        } catch (e) {
          console.warn(`Error closing screen peers ${key}`);
        }
      });
      this.setState({ joinedRoom: null, room: '' });
      return;
    }
    console.log("userType ", this.state.userType)

    const roomInputValue = this.state.roomInput;
    // alert that the room name is required
    if (roomInputValue.length === 0) {
      Alert.alert('Room Name is required.');
      return;
    }
    try {
      this.connectWs();
      // actually join the room if the above checks pass
    }
    catch (e) {
      Alert.alert(e);
      return;
    }
  };
  handleMessage = async (event) => {

    var parsedData = event.data
    var remoteScreenSharing = parsedData.local_screen_sharing;
    var localScreenSharing = parsedData.remote_screen_sharing;
    var src_user_id = parsedData.src_user_id;
    var dest_user_id = parsedData.dest_user_id;
    var parsed_room_id = parsedData.room_id;
    var receiver_channel_name = parsedData.receiver_channel_name;
    console.log("parsedData", parsedData)
    console.log("current user id :", this.state.userId);

    if (parsed_room_id != this.state.joinedRoom) {

      return;
    }

    try {
      if (parsedData.success == false && this.state.userId == dest_user_id) {
        throw new Error(parsedData.message);
      }
    }
    catch (e) {
      console.log("websocket error  ", e)
      Alert.alert("Websocket error : " + e);
      if (parsedData.action == "viewer_join_room") {
        this.ws.dispatchEvent({ type: "error", e });
        return
      }
    }

    if (dest_user_id && dest_user_id != this.state.userId) {
      // ignore all messages from oneself
      return;
    }

    switch (parsedData.action) {
      case 'viewer_join_room':
        console.log(`User ${parsedData.receiver_channel_name} joined room`);
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
        console.log(`Current user ${this.state.userId} SDP Offer received from ${src_user_id} to user ${dest_user_id}`);
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
          peer = this.state.mapPeers.get(src_user_id + ' Screen')[0];
        } else if (localScreenSharing) {
          // if offerer was screen sharer
          peer = mapScreenPeers[src_user_id][0];
        } else {
          // if both are non-screen sharers
          peer = this.state.mapPeers.get(src_user_id)[0];
        }

        // get the answer
        var answer = parsedData['sdp'];

        console.log('mapPeers:');
        for (key in this.state.mapPeers.keys()) {
          console.log(key, ': ', this.state.mapPeers.get(key));
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
        Alert.alert(nodeText)
        break;
      case "streamer_join_room":
        this.setState({ wsSessionId: receiver_channel_name })
        break;
      default:
        console.warn(`Unrecognized method: ${parsedData.action}`);
        break;

    }

  };



  closePeer = async (sessionId) => {
    console.log('closePeer ', sessionId);
    const peer = this.state.mapPeers.get(sessionId)[0];
    if (peer) {
      peer.close();
    }
    const peers = this.state.mapPeers;
    peers.delete(sessionId);

    this.setState({
      mapPeers: new Map(peers),
    });
    this.removeVideo(sessionId);
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
        stream => {
          this.setState({ localStream: stream });
          var audioTracks = stream.getAudioTracks();
          var videoTracks = stream.getVideoTracks();
          this.setState({
            audioTracks: audioTracks,
            videoTracks: videoTracks
          })
          console.log("audiotracks : ", this.state.audioTracks);
          console.log("videoTracks : ", this.state.videoTracks);
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
    this.setState({
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
    this.setState({ streams: new Map(streams) });
  };

  roomInputChange = (roomInput) => this.setState({ roomInput });
  userIdInputChange = (userId) => this.setState({ userId })
  chatInputChange = (message) => this.setState({ message });

  addLocalTracks = (peer, localScreenSharing) => {
    if (!localScreenSharing) {
      // if it is not a screen sharing peer
      // add user media tracks
      this.state.localStream.getTracks().forEach(track => {
        console.log('Adding localStream tracks.',track);
        this.setState({remoteStream:track})
        peer.addStream(track);
      });

      return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    this.state.localDisplayStream.getTracks().forEach(track => {
      console.log('Adding localDisplayStream tracks.');
      peer.addStream(track);
    });
  }


  // create RTCPeerConnection as offerer
  // and store it and its datachannel
  // send sdp to remote peer after gathering is complete
  createOfferer = async (srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {

    const peer = this.state.peer;

    this.setState({remoteUserId:srcPeerUserId});
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
      const tempMapPeers = this.state.mapPeers.set(srcPeerUserId, [peer, dc]);
      this.setState({
        mapPeers: tempMapPeers
      })

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          console.log('Deleting peer');
          const tempMapPeers = this.state.mapPeers;
          tempMapPeers.delete(srcPeerUserId);
          this.setState({
            mapPeers: tempMapPeers
          })

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
      const tempMapPeers = this.state.mapPeers.set(srcPeerUserId + ' Screen', [peer, dc]);
      this.setState({
        mapPeers: tempMapPeers
      })


      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {

          const tempMapPeers = this.state.mapPeers;

          tempMapPeers.delete(srcPeerUserId + ' Screen');
          this.setState({
            mapPeers: tempMapPeers
          })
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


      const tempMapScreenPeers = this.state.mapScreenPeers.set(srcPeerUserId, [peer, dc]);
      this.setState({
        mapScreenPeers: tempMapScreenPeers
      })


      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {

          const tempMapScreenPeers = this.state.mapScreenPeers;
          tempMapScreenPeers.delete(srcPeerUserId);
          this.setState({
            mapScreenPeers: tempMapScreenPeers
          })

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
        "room_id": this.state.joinedRoom,
        "src_user_id": destPeerUserId,
        "dest_user_id": srcPeerUserId
      });
    }

    peer.createOffer()
      .then(o => peer.setLocalDescription(o))
      .then(function (event) {
        console.log("Local Description Set successfully.");
      });

    console.log('mapPeers[', srcPeerUserId, ']: ', this.state.mapPeers.get(srcPeerUserId));

    this.setState({ peer: peer });
  }

  dcOnMessage = (event) => {
    var message = event.data;


  }

  setOnTrack = (peer, receiver_channel_name) => {

    peer.addEventListener('track', async (event) => {
      await this.addVideo(receiver_channel_name, event.track);
    });
  }
  // create RTCPeerConnection as answerer
  // and store it and its datachannel
  // send sdp to remote peer after gathering is complete
  createAnswerer = async (offer, srcPeerUserId, destPeerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
    const peer = this.state.peer;

    this.setState({remoteUserId:srcPeerUserId});
    this.addLocalTracks(peer, localScreenSharing);
    
    if (!localScreenSharing && !remoteScreenSharing) {
      // if none are sharing screens (normal operation)

      // and add tracks to remote video
      this.setOnTrack(peer, receiver_channel_name);

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
        const tempMapPeers = this.state.mapPeers.set(srcPeerUserId, [peer, peer.dc])
        this.setState({ mapPeers: tempMapPeers })
      }

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          var tempMapPeers = this.state.mapPeers;
          tempMapPeers.delete(srcPeerUserId + ' Screen')
          this.setState({ mapPeers: new Map(tempMapPeers) })

          if (iceConnectionState != 'closed') {
            peer.close();
          }

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
        const tempMapScreenPeers = this.state.mapScreenPeers.set(srcPeerUserId, [peer.peer.dc]);
        this.setState({ mapScreenPeers: tempMapScreenPeers });

        peer.oniceconnectionstatechange = () => {
          var iceConnectionState = peer.iceConnectionState;
          if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            const tempMapScreenPeers = this.state.mapScreenPeers;
            tempMapScreenPeers.delete(srcPeerUserId);
            this.setState({ mapScreenPeers: tempMapScreenPeers });
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
        var tempMapPeers = this.state.mapPeers.set(srcPeerUserId + ' Screen', [peer, peer.dc])
        this.state.setState({ mapPeers: tempMapPeers })

      }
      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
          var tempMapPeers = this.state.mapPeers;
          tempMapPeers.delete(srcPeerUserId + ' Screen')
          this.setState({ mapPeers: new Map(tempMapPeers) })

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
        "room_id": this.state.joinedRoom,
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
        // console.log('localDescription: ', peer.localDescription);
        // console.log('remoteDescription: ', peer.remoteDescription);
      })
      .catch(error => {
        console.log('Error creating answer for %s.', srcPeerUserId);
        console.log(error);
      });

    this.setState({ peer: peer });
  }


  switchCamera = () => {
    this.state.localStream.getVideoTracks().forEach(track => {
      track._switchCamera();
    });
  }
  toggleCamera = () => {
    this.state.localWebcamOn ? this.setState({ localWebcamOn: false }) : this.setState({ localWebcamOn: true });
    const localStream = this.state.localStream;
    localStream.getVideoTracks().forEach(track => {
      this.state.localWebcamOn ? (track.enabled = false) : (track.enabled = true);
    });
    this.setState({ localStream: localStream });
    console.log(this.state.localWebcamOn);
  }



  render() {
    return (
      <View style={[styles.flex, styles.rootContainer]}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={[styles.flex, styles.rootContainer]}>
          <Text style={styles.label}>WebRTC Demo {this.state.wsSessionId}</Text>
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
              {/* {[...this.state.streams.keys()].map((k) => (
                <View key={k} style={styles.flex}>
                  <RTCView
                    key={k}
                    stream={this.state.streams.get(k)}
                    objectFit="contain"
                    style={styles.flex}
                  />
                  <Text style={styles.streamLabel}>{k}</Text>
                </View>
              ))} */}
              {
                this.state.userType && this.state.userType!="streamer" && this.state.remoteStream ?
                  (
                    <video key={this.state.remo} srcObject={this.state.remoteStream.stream} autoPlay={true} />
                  ) : null
              }
              { this.state.userType && this.state.userType=="streamer" && this.state.localStream ? (
                <RTCView
                  objectFit={'cover'}
                  style={{ flex: 1, backgroundColor: '#050A0E' }}
                  streamURL={this.state.localStream.toURL()}
                />
              ) : null}

            </View>

            <View style={styles.shrinkingChildContainer}>

              <Text style={styles.label}>
                Chat
              </Text>
              {this.state.joinedRoom && (
                <>
                  <TextInput
                    onChangeText={this.chatInputChange}
                    placeholder={'message'}
                    // onSubmitEditing={this.joinOrLeaveRoom}
                    // returnKeyType={'join'}
                    value={this.state.message}
                    style={{ flexGrow: 1 }}
                  />
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
                </>

              )}

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
                <>

                  <Button
                    onPress={() => {
                      this.switchCamera();

                    }}
                    title='switch camera'
                  >
                  </Button>

                  <Button
                    onPress={() => {
                      this.toggleCamera();

                    }}
                    title='Enable disable camera'
                  >
                  </Button>
                </>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }
}
export default Demo;