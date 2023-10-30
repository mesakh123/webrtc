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
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track);
  });
};

const setRemoteTracks = async (peer, srcPeerUserId, isRemoteDisplayStream) => {
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

//Handling Connection State Change of a peer
const setICEConnectionStateChange =(peerConnection) =>{
  console.log("Set iceconnection statechange event");
  peerConnection.oniceconnectionstatechange = (event) => {
    var iceConnectionState = peerConnection.iceConnectionState;
    if (
      iceConnectionState === "disconnected" ||
      iceConnectionState === "failed" ||
      iceConnectionState === "closed"
    ) {
      if (iceConnectionState !== "closed") {
        peerConnection.close();
        peerConnection = null;
        pc = null;
      }
      setRemoteStream(null);
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

  addMediaTracks(peerConnection);

  //Set the onicecandidate event
  setIceCandidateEvent(peerConnection, receiver_channel_name);

  //Create video element for remote Peer
  setRemoteTracks(peerConnection, peerUserId);

  //set the oniceconnectionstatechange event
  setICEConnectionStateChange(peerConnection);

  //CreateOffer
  createoffer(peerConnection, receiver_channel_name);

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
  setICEConnectionStateChange(peerConnection);

  //CreateAnswer
  createanswer(peerConnection, offer, receiver_channel_name);

  //console.log("Peer Connection: ",peerConnection);
  return peerConnection;
};

const receiveAnswer = async(peerConnection,answer)=>{
    if(answer)
    {
        const remoteDesc = new RTCSessionDescription(answer);
        await peerConnection.setRemoteDescription(remoteDesc);
        //console.log("Remote desc done");
    }
}