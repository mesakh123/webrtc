
const socket = io('http://localhost:3000');

const app = new Vue({
    el: '#app',
    data: {
        localstream: null,
        pc: null,
        videoTracks: null,
        audioTracks: null,
        configuration: {
            iceServers: [{
                urls: 'stun:stun.l.google.com:19302' // Google's public STUN server
            }]
        },
        signalOption: {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        },
        offer: null,
        room: null,
        text: null,
    },
    created() {
        this.onSocket();
    },
    methods: {
        async initPeerConnection() {
            await this.createMedia();
            this.getAudioVideo();
            this.createPeerConnection();
            this.addLocalStream();
            this.onIceCandidates();
            this.onIceconnectionStateChange();
            this.onAddStream();
            // this.onSocket();
        },
        async createMedia() {
            // 儲存本地流到全域
            this.localstream = await window.navigator.mediaDevices.getUserMedia({ audio: true, video: true })

            this.$refs.myVideo.srcObject = this.localstream;
        },
        // 取得裝置名稱
        getAudioVideo() {
            this.videoTracks = this.localstream.getVideoTracks();
            this.audioTracks = this.localstream.getAudioTracks();

            if (this.videoTracks.length > 0) {
                console.log(`影像配置: ${this.videoTracks[0].label}`)
            };
            if (this.audioTracks.length > 0) {
                console.log(`聲音配置: ${this.audioTracks[0].label}`)
            };
        },
        createPeerConnection() {
            // 建立 P2P 連接
            this.pc = new RTCPeerConnection(this.configuration);
            console.log(`建立 peer connection`);
        },
        addLocalStream() {
            // 增加本地流
            this.pc.addStream(this.localstream)
        },
        onIceCandidates() {
            // 監聽 Ice Server
            // 找尋到 ICE 候選位置後，送去 server 與另一位配對
            this.pc.onicecandidate = ({ candidate }) => {
                if (!candidate) { return; }
                console.log('onIceCandidate => ', candidate);
                socket.emit("peerconnectSignaling", {
                    candidate,
                    to: 'jedy-0',
                    from: 'hiro-1',
                    room: '0509'
                });
            };
        },
        onIceconnectionStateChange() {
            // 監聽 Ice 連接狀態
            this.pc.oniceconnectionstatechange = (evt) => {
                console.log('ICE 伺服器狀態變更 => ', evt.target.iceConnectionState);
            };
        },
        onAddStream() {
            // 監聽是否有流傳入，如果有的話就顯示影像
            this.pc.onaddstream = (event) => {
                console.log('this => ', this)
                if (!this.$refs.remoteVideo.srcObject && event.stream) {
                    this.$refs.remoteVideo.srcObject = event.stream;
                    console.log('接收流並顯示於遠端視訊！', event);
                }
            }
        },
        // --------------
        sendSignalingMessage(desc, offer) {
            const isOffer = offer ? "offer" : "answer";
            console.log(`寄出 ${isOffer}`);
            socket.emit("peerconnectSignaling", {
                desc: desc,
                to: 'jedy-0',
                from: 'hiro-1',
                room: '0509'
            });
        },
        async createSignal(isOffer) {
            try {
                if (!this.pc) {
                    console.log('尚未開啟視訊')
                    return;
                }
                this.offer = await this.pc[`create${isOffer ? 'Offer' : 'Answer'}`](this.signalOption);

                await this.pc.setLocalDescription(this.offer);
                this.sendSignalingMessage(this.pc.localDescription, isOffer ? true : false)
            } catch (err) {
                console.log(err);
            }
        },
        onSocket() {
            const vm = this;
            socket.on('peerconnectSignaling', async ({ desc, from, candidate }) => {
                if (desc && !vm.pc.currentRemoteDescription) {
                    console.log('desc => ', desc);
                    await vm.pc.setRemoteDescription(new RTCSessionDescription(desc));
                    await vm.createSignal(desc.type === 'answer' ? true : false);
                } else if (candidate) {
                    console.log('candidate =>', candidate);
                    vm.pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });
            socket.on('message', message => {
                console.log('房間接收 => ', message);
            });
            socket.on('roomBroadcast', message => {
                console.log('房間廣播 => ', message);
            });
        },
        joinRoom() {
            if (!this.room) {
                return;
            }
            socket.emit('joinRoom', this.room);
            this.room = null;
        },
        sendText() {
            if (!this.text) {
                return;
            }
            socket.emit('message', this.text);
            this.text = null;
        },
        closeTrack(trackName, isOpen) {
            // console.log(this.videoTracks);
            this[`${trackName}Tracks`][0].enabled = isOpen
            this[`${trackName}Tracks`] = this.localstream[trackName === 'video' ? 'getVideoTracks' : 'getAudioTracks']()
        }
    },
});
