
    if (!e.candidate) return;
    const [localStream, setLocalStream] = useState();
    const [remoteStream, setRemoteStream] = useState();
  
    const [gettingCall, setGettingCall] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
  
  
    const [callState, setCallState] = useState({
      mutted: false,
      video: false,
    });
  
    const pc = useRef(null);
    const connecting = useRef(false);
  
   useEffect(() => {
      const cRef = firestore().collection('meet').doc(callId);
  
      const subscribe = cRef.onSnapshot(snapshot => {
        const data = snapshot.data();
  
        if (pc.current && !pc.current.remoteDescription && data && data.answer) {
          pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
  
        if (data && data.offer && !connecting.current) {
          setGettingCall(true);
        }
      });
  
      const subscribeDelete = cRef.collection('callee').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type == 'removed') {
            hangup();
          }
        });
      });
  
      return () => {
        subscribe();
        subscribeDelete();
      };
    }, []);
  
    const setupWebrtc = async () => {
      pc.current = new RTCPeerConnection({
        iceServers: [...getTurnServers(), {url: 'stun:stun.1und1.de:3478'}],
      });
  
      const stream = await Utils.getStream();
      if (stream) {
        setLocalStream(stream);
        pc.current.addStream(stream);
      }
  
      pc.current.onaddstream = event => {
        setRemoteStream(event.stream);
      };
    };
  
    const create = async () => {
      console.log('Calling');
      connecting.current = true;
  
      await setupWebrtc();
  
      const cRef = firestore().collection('meet').doc(callId);
  
      collectIceCandidates(cRef, 'caller', 'callee');
  
      if (pc.current) {
        const offer = await pc.current.createOffer();
        pc.current.setLocalDescription(offer);
  
        const cWithOffer = {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        };
  
        setGettingCall(false);
  
        cRef.set(cWithOffer);
        InCallManager.setSpeakerphoneOn(true);
      }
    };
  
    const join = async () => {
      console.log('Joining the call');
      connecting.current = true;
      setGettingCall(false);
      InCallManager.setSpeakerphoneOn(true);
  
      const cRef = firestore().collection('meet').doc(callId);
      const offer = (await cRef.get()).data()?.offer;
  
      if (offer) {
        await setupWebrtc();
        collectIceCandidates(cRef, 'callee', 'caller');
  
        if (pc.current) {
          pc.current.setRemoteDescription(new RTCSessionDescription(offer));
  
          const answer = await pc.current.createAnswer();
          pc.current.setLocalDescription(answer);
  
          const cWithAnswer = {
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
          };
          cRef.update(cWithAnswer);
        }
      }
    };
  
  
  const collectIceCandidates = async (cRef, localName, remoteName) => {
      const candidateCollection = cRef.collection(localName);
  
      if (pc.current) {
        pc.current.onicecandidate = event => {
          if (event.candidate) {
            candidateCollection.add(event.candidate);
          }
        };
      }
  
      cRef.collection(remoteName).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type == 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.current?.addIceCandidate(candidate);
          }
        });
      });
    };