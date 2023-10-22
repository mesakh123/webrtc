import React, { useEffect, useRef, useState } from 'react';
import uuid from 'react-native-uuid';
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

import io from "socket.io-client";

function Demo5() {
    const [localStream, setLocalStream] = useState(null);
    const [localDisplayStream, setLocalDisplayStream] = useState(null);
    const remoteStreams = useRef(new Map());
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

    const wsEndPoint = "wss://mango-live.website/ws/test-live-room/"
    const webSocket = useRef(null);
    const addLocalTracks = (peer, localScreenSharing) => {
        if (!localScreenSharing) {
            // if it is not a screen sharing peer
            // add user media tracks

            peer.addStream(localStream);
            localStream.getTracks().forEach(track => {
                console.log('Adding localStream tracks.');
                peer.getLocalStreams()[0].addTrack(track);
            });
            return;
        }

        // if it is a screen sharing peer
        // add display media tracks
        peer.addStream(localDisplayStream);
        localDisplayStream.getTracks().forEach(track => {
            console.log('Adding localStream tracks.');
            peer.getLocalStreams()[0].addTrack(track);
        });

    };
    const OFFERICESERVERS = [

        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun.ekiga.net' },
        { urls: 'stun.ideasip.com' },
        { urls: 'stun.rixtelecom.se' },
        { urls: 'stun.schlund.de' },
        { urls: 'stun.stunprotocol.org:3478' },
        { urls: 'stun.voiparound.com' },
        { urls: 'stun.voipbuster.com' },
        { urls: 'stun.voipstunt.com' },
        { urls: 'stun.voxgratia.org' },
    ]

    const ANSWERICESERVERS = [

        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun.ekiga.net' },
        { urls: 'stun.ideasip.com' },
        { urls: 'stun.rixtelecom.se' },
        { urls: 'stun.schlund.de' },
        { urls: 'stun.stunprotocol.org:3478' },
        { urls: 'stun.voiparound.com' },
        { urls: 'stun.voipbuster.com' },
        { urls: 'stun.voipstunt.com' },
        { urls: 'stun.voxgratia.org' },
    ]

    const mappingOfferPeerConnection = (srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection, dc) => {
        var currentMapPeers = null;

        if (!localScreenSharing && !remoteScreenSharing) {

            // store the RTCPeerConnection
            // and the corresponding RTCDataChannel
            currentMapPeers = mapPeers.current.set(srcPeerUserId, [peerConnection, dc])
            peerConnection.oniceconnectionstatechange = () => {
                var iceConnectionState = peerConnection.iceConnectionState;
                if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                    console.log('Deleting peer');
                    currentMapPeers.delete(srcPeerUserId)
                    if (iceConnectionState != 'closed') {
                        peerConnection.close();
                    }
                }
            };
            mapPeers.current = new Map(currentMapPeers)
        }
        else if (!localScreenSharing && remoteScreenSharing) {
            // answerer is screen sharing

            currentMapPeers = mapPeers.current.set(srcPeerUserId + ' Screen', [peerConnection, dc])

            peerConnection.oniceconnectionstatechange = () => {
                var iceConnectionState = peerConnection.iceConnectionState;
                if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                    currentMapPeers.delete(srcPeerUserId)
                    if (iceConnectionState != 'closed') {
                        peerConnection.close();
                    }
                }
            };
            mapPeers.current = new Map(currentMapPeers)

        }
        else {
            currentMapPeers = mapScreenPeers.current.set(srcPeerUserId, [peerConnection, dc])
            peerConnection.oniceconnectionstatechange = () => {
                var iceConnectionState = peerConnection.iceConnectionState;
                if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                    currentMapPeers.delete(srcPeerUserId)
                    if (iceConnectionState != 'closed') {
                        peerConnection.close();
                    }
                }
            };
            mapScreenPeers.current = new Map(currentMapPeers)
        }
    };


    const createOffer = async (peerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
        // Create RTCPeerConnection
        const peerConnection = new RTCPeerConnection(
            {
                iceservers: OFFERICESERVERS,
                iceCandidatePoolSize: 10,
            }
        );

        addLocalTracks(peerConnection, localScreenSharing);
        var dataChannel = peerConnection.createDataChannel("channel");

        // Add local media stream to RTCPeerConnection

        console.log("addlocaltrack start")
        console.log("addlocaltrack end")

        // Handle incoming ICE candidates
        // peerConnection.onicecandidate = e => {
        //     if (e.candidate) {
        //         socket.emit("ice candidate", e.candidate, id);
        //     }
        // };

        // // Handle incoming remote media stream
        // peerConnection.onaddstream = e => {
        //     setRemoteStreams(prevStreams => [
        //         ...prevStreams,
        //         { peerUserId, stream: e.stream, channel: dataChannel },
        //     ]);
        // };
        mappingOfferPeerConnection(peerUserId, localScreenSharing, remoteScreenSharing,
            peerConnection, dataChannel);


        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                return;
            }
            sendSignal("new-offer", {
                "sdp": peerConnection.localDescription,
                "receiver_channel_name": receiver_channel_name,
                "local_screen_sharing": localScreenSharing,
                "remote_screen_sharing": remoteScreenSharing,
            });

        }

        // Create and send offer
        peerConnection.createOffer().then(
            offer => peerConnection.setLocalDescription(offer)
        );

        setPeerConnections(prevConnections => [
            ...prevConnections,
            { peerUserId, peer: peerConnection },
        ]);
    }
    const setOnTrack = async (peer, srcUserId) => {
        var mediaStream = new MediaStream();

        peer.ontrack = async (event) => {
            event.streams[0].getTracks().forEach(track => {
                console.log('Adding track: ', track);
                mediaStream.addTrack(track);
            });

            var currentMap = remoteStreams.current;
            currentMap = currentMap.set(srcUserId, mediaStream)
            remoteStreams.current = new Map(currentMap);
        };
        peer.onaddstream = event => {

            console.log("before remoteStreams", remoteStreams.current)
            var currentMap = remoteStreams.current;
            currentMap = currentMap.set(srcUserId, event.stream);
            remoteStreams.current = new Map(currentMap);
            console.log("after remotestream", remoteStreams.current);
        };
    }

    const mappingAnswerPeerConnection = (srcPeerUserId, localScreenSharing, remoteScreenSharing, peerConnection) => {
        if (!localScreenSharing && !remoteScreenSharing) {
            // if none are sharing screens (normal operation)

            // it will have an RTCDataChannel
            var currentMapPeers = mapPeers.current;
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
            mapPeers.current = new Map(currentMapPeers)

        }
        else if (localScreenSharing && !remoteScreenSharing) {
            // answerer itself is sharing screen

            var currentMapPeers = mapScreenPeers.current;
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
            mapScreenPeers.current = new Map(currentMapPeers);

        }

        else {
            // offerer is sharing screen
            var currentMapPeers = mapPeers.current;
            setOnTrack(peerConnection, srcPeerUserId);
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
            mapPeers.current = new Map(currentMapPeers)

        }
    }
    const createAnswer = async (offer, peerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name) => {
        // Create RTCPeerConnection
        const peerConnection = new RTCPeerConnection(
            {
                iceservers: ANSWERICESERVERS,

                iceCandidatePoolSize: 10,
            }
        );

        // Add local media stream to RTCPeerConnection
        addLocalTracks(peerConnection, localScreenSharing);

        mappingAnswerPeerConnection(peerUserId, localScreenSharing, remoteScreenSharing, peerConnection);

        // Handle incoming ICE candidates
        peerConnection.onicecandidate = e => {
            if (e.candidate) {
                // socket.emit("ice candidate", e.candidate, id);
                return;
            }
            sendSignal('new-answer', {

                "sdp": peerConnection.localDescription,
                "receiver_channel_name": receiver_channel_name,
                "local_screen_sharing": localScreenSharing,
                "remote_screen_sharing": remoteScreenSharing,
            });
        };

        // Set remote description and create and send answer
        peerConnection.setRemoteDescription(offer)
            .then(() => {
                console.log('Set offer from %s.', peerUserId);
                return peerConnection.createAnswer();
            })
            .then(a => {
                return peerConnection.setLocalDescription(a);
            })
            .catch(error => {
                console.log('Error creating answer for %s.', peerUserId);
                console.log(error);
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
    useEffect(() => {

        // Get local media stream
        connectDevices();

        // // Cleanup
        // return () => {
        //     socket.disconnect();
        //     peerConnections.forEach(connection => connection.peerConnection.close());
        // };
    }, []);


    const receiveNewAnswer = (sdp, src_user_id, localScreenSharing, remoteScreenSharing) => {
        var peerKey = src_user_id;
        var currentMapPeers = mapPeers.current;
        var currentPeerConnection = null;
        var currentPeersDC = null;
        if (remoteScreenSharing) {
            // if answerer is screen sharer
            peerKey = src_user_id + ' Screen';
            currentPeerConnection = currentMapPeers.get(peerKey)[0];
            currentPeersDC = currentMapPeers.get(peerKey)[1];
        } else if (localScreenSharing) {
            currentMapPeers = mapScreenPeers.current;
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
            mapPeers.current = new Map(currentMapPeers)

        }
        else {
            mapScreenPeers.current = new Map(currentMapPeers);

        }

    }

    const handleMessage = (event) => {
        // Handle 'join' message
        var parsedData = event
        var peerUserId = parsedData.peer;
        console.log("peerUserId", peerUserId)
        console.log("userId", userId.current)
        if (peerUserId === userId.current) {
            return;
        }

        var remoteScreenSharing = parsedData.message.local_screen_sharing;
        var localScreenSharing = parsedData.message.remote_screen_sharing;
        var receiver_channel_name = parsedData.message.receiver_channel_name;
        var action = parsedData.action;

        if (action == "new-peer") {
            console.log("Create new offer for user " + peerUserId + "with receiver_channel_name" + receiver_channel_name)
            createOffer(peerUserId, false, remoteScreenSharing, receiver_channel_name);
            if (isShareScreen && !remoteScreenSharing) {
                createOffer(peerUserId, true, remoteScreenSharing, receiver_channel_name);
            }
            return;
        }

        else if (action == "new-offer") {
            var offer = parsedData.message.sdp;
            console.log("Create new answer for user " + peerUserId + "with receiver_channel_name" + receiver_channel_name)
            createAnswer(offer, peerUserId, localScreenSharing, remoteScreenSharing, receiver_channel_name);
            return;
        }

        else if (action == "new-answer") {
            console.log("Receive new answer for user " + peerUserId + "with receiver_channel_name" + receiver_channel_name)

            receiveNewAnswer(parsedData.message.sdp, peerUserId, localScreenSharing, remoteScreenSharing);

            return;
        }



        // // Handle 'ice candidate' message
        // socket.on("ice candidate", async (candidate, id) => {
        //     const targetConnection = peerConnections.find(
        //         connection => connection.id === id
        //     );
        //     await targetConnection.peerConnection.addIceCandidate(candidate);
        // });

        // // Handle 'leave' message
        // socket.on("leave", id => {
        //     setRemoteStreams(prevStreams =>
        //         prevStreams.filter(stream => stream.id !== id)
        //     );
        //     setPeerConnections(prevConnections =>
        //         prevConnections.filter(connection => connection.id !== id)
        //     );
        // });

        // socket.on("chat", msg => {
        //     Alert.alert(msg);
        // });
    }

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

    // Function to start screen sharing
    const startScreenShare = () => {
        mediaDevices.getDisplayMedia({ audio: false, video: false })
            .then(stream => {
                setScreenShareStream(stream);
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        track.enabled = false;
                    });
                    stream.getTracks().forEach(track => {
                        localStream.addTrack(track);
                    });
                }
            });
    };


    // Function to stop screen sharing
    const stopScreenShare = () => {
        screenShareStream.getTracks().forEach(track => {
            localStream.removeTrack(track);
        });
        setScreenShareStream(null);
        localStream.getTracks().forEach(track => {
            track.enabled = true;
        });
    };

    const toggleShareScreen = () => {
        if (isShareScreen) {
            stopScreenShare();
        }
        else {
            startScreenShare();
        }
        setIsShareScreen(!isShareScreen);
    }


    const connectWs = () => {

        // eslint-disable-next-line no-undefz
        console.log("Prepare to connect ...");

        console.log("Start web socket")
        webSocket.current = new WebSocket(wsEndPoint);

        webSocket.current.onopen = () => {
            console.log('WebSocket Client Connected');
            // notify other peers

            sendSignal("new-peer", {
                'local_screen_sharing': false,
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
        }
    };


    const joinRoom = () => {
        if (isJoin) {

            sendSignal(
                "leave", {
                "id": userId
            }
            )
        } else {
            connectWs();

        }
        setIsJoin(!isJoin);
    }

    const sendSignal = (action, message) => {
        webSocket.current.send(
            JSON.stringify(
                {
                    'peer': userId.current,
                    'action': action,
                    'message': message,
                }
            )
        )
    };

    const sendMesage = (message) => {
        console.log("mapPeers", mapPeers);
        if (mapPeers) {
            [...mapPeers.current.keys()].forEach(key => {
                var dataChannel = mapPeers.current.get(key)[1];
                dataChannel.send(message);
            });
        }

    }


    return (
        <View style={[styles.flex, styles.rootContainer]}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={[styles.flex, styles.rootContainer]}>
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={[styles.flex, styles.borderedContainer]}>
                        {
                            remoteStreams.current ? (
                                [...remoteStreams.current.keys()].map(key => {
                                    <RTCView
                                        key={key}
                                        style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                                        objectFit={'cover'}
                                        streamURL={remoteStreams.current.get(key).stream.toURL()} />

                                })
                            ) : null
                        }
                        {/* 

                        {
                            localStream ? (<RTCView
                                style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}

                                objectFit={'cover'}
                                streamURL={localStream.toURL()}
                            />) : null
                        } */}


                    </View>

                    <View style={styles.shrinkingContainer}>
                        {
                            !isJoin ? (
                                <Button
                                    onPress={joinRoom}
                                    title="join"
                                />
                            ) : (

                                <>

                                    <Text style={styles.label}>
                                        Chat
                                    </Text>
                                    <TextInput
                                        onChangeText={(msg) => { setMessage(msg) }}
                                        placeholder={'message'}
                                        // onSubmitEditing={this.joinOrLeaveRoom}
                                        // returnKeyType={'join'}
                                        value={message}
                                        style={{ flexGrow: 1 }}
                                    />
                                    <Button
                                        onPress={sendMesage}
                                        title='Send'
                                    ></Button>
                                </>

                            )
                        }
                    </View>



                    <View>
                        <Button
                            onPress={toggleAudio}
                            title={audioEnabled ? "Mute  Audio" : "Unmute  Audio"}
                        >
                        </Button>

                        <Button
                            onPress={toggleVideo}
                            title={videoEnabled ? "Stop Video" : "Start Video"}
                        >
                        </Button>

                        <Button
                            onPress={toggleShareScreen}
                            title={isShareScreen ? " Stop Screen Share" : "Start Screen Share"}
                        >
                        </Button>


                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    )

}

export default Demo5;