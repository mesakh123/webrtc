import VIForegroundService from '@voximplant/react-native-foreground-service';

const startForegroundService = async () => {
    if (Platform.OS !== 'android') {
        // alert('Only Android platform is supported');
        await startBroadcast()
        startScreenSharingService()

        return;
    }
    if (Platform.Version >= 26) {
        const channelConfig = {
            id: 'ForegroundServiceChannel',
            name: 'Notification Channel',
            description: 'Notification Channel for Foreground Service',
            enableVibration: false,
            importance: 2
        };
        await VIForegroundService.createNotificationChannel(channelConfig);
    }
    const notificationConfig = {
        id: 3456,
        title: 'Foreground Service',
        text: 'Foreground service is running',
        icon: 'ic_notification',
        priority: 2
    };
    if (Platform.Version >= 26) {
        notificationConfig.channelId = 'ForegroundServiceChannel';
    }
    VIForegroundService.startService(notificationConfig).then(async () => {
        startScreenSharingService()
    })

}

const startBroadcast = async () => {
    const reactTag = findNodeHandle(screenCaptureView.current);
    return NativeModules.ScreenCapturePickerViewManager.show(reactTag);

    // return 
}

const startScreenSharingService = async () => {
    dispatch(CallAtions.setIsScreenSharing(true))
    const constraints = {
        // audio: true,
        video: true,
        // video: {
        //     mandatory: {
        //         minWidth: 500, // Provide your own width, height and frame rate here
        //         minHeight: screenHeight,
        //         minFrameRate: 30,
        //     },

        // },
    };
    try {
        const newStream = await mediaDevices.getDisplayMedia(constraints);
        // console.log('streamvalue' + JSON.stringify(newStream));
        // dispatch(CallAtions.setLocalStream(newStream))
        setLocalStream(newStream);
        // setActiveStreem(newStream)
        connectedParicipants.forEach((uid) => {
            // console.log({ uid, peerConnections })
            peerConnections[uid].addStream(newStream)

        })
        // demonstrates how to detect that the user has stopped
        // sharing the screen via the browser UI.
        newStream.getVideoTracks()[0].addEventListener('ended', () => {
            // this.videoStreamSender
            // .find((sender) => sender.track.kind === 'video')
            // .replaceTrack(this.SharescreenReplace.getTracks()[1]);
            console.log('The user has ended sharing the screen');

        });
    } catch (err) {
        console.log({ err })

    }
}
const shareScreen = async () => {
    startForegroundService()
    sheetref.current.close()

};
