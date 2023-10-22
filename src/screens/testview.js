<View style={[styles.flex, styles.rootContainer]}>
    <StatusBar barStyle="dark-content" />
    <SafeAreaView style={[styles.flex, styles.rootContainer]}>
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.flex, styles.borderedContainer]}>

                {alertText ? (
                    <TouchableOpacity onPress={joinOrLeaveRoom}>
                        <Text style={styles.alertLabel}>{alertText}</Text>
                    </TouchableOpacity>
                ) : null}
                {(userType == "streamer") ? (

                    <>
                        <Text style={styles.label}>Video</Text>
                        {
                            localStream ? (
                                <>

                                    <RTCView
                                        objectFit={'cover'}
                                        style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                                        streamURL={localStream.toURL()}
                                    />
                                </>) : null
                        }
                    </>

                ) : (
                    <>
                        <Text style={styles.label}>Streamer Video</Text>
                        {
                            remoteStream ? (
                                <RTCView
                                    objectFit={'cover'}
                                    style={{ flex: 1, backgroundColor: '#050A0E', height: 50 }}
                                    streamURL={remoteStream.toURL()}
                                />
                            ) : null
                        }
                    </>

                )}
            </View>


            <View >

                <Text style={styles.label}>
                    Chat {joinedRoom.current}
                </Text>
                {joinedRoom.current != null && (
                    <>
                        <TextInput
                            onChangeText={(msg) => { setMessage(msg) }}
                            placeholder={'message'}
                            // onSubmitEditing={this.joinOrLeaveRoom}
                            // returnKeyType={'join'}
                            value={message}
                            style={{ flexGrow: 1 }}
                        />
                        <Button
                            onPress={() => {
                                let currentMessage = message;
                                // send offer to new peer
                                // after ice candidate gathering is complete
                                sendSignal('chat', {
                                    "room_id": roomId,
                                    "src_user_id": userId,
                                    "message": currentMessage,
                                });

                                setMessage(null);
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
                        {joinedRoom.current && `: ${joinedRoom.current}`}
                    </Text>
                    {!joinedRoom.current && (
                        <TextInput
                            onChangeText={(value) => {
                                setRoomId(value)
                            }}
                            placeholder={'Room Name'}
                            testID={'roomInput'}
                            // onSubmitEditing={this.joinOrLeaveRoom}
                            // returnKeyType={'join'}
                            value={roomId}
                            style={styles.roomInput}
                        />
                    )}
                </View>
            </View>
            <View style={styles.shrinkingContainer}>
                <View>
                    <Text style={styles.label}>
                        User ID
                        {joinedRoom.current && `: ${userId}`}
                    </Text>
                    {!joinedRoom.current && (
                        <TextInput
                            onChangeText={(value) => { setUserId(value) }}
                            placeholder={'User ID'}
                            // returnKeyType={'join'}
                            value={userId}
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
                        value={userType}
                        onChange={item => {
                            setUserType(item["value"]);
                        }}
                        renderLeftIcon={() => (
                            <AntDesign
                                style={styles.icon}
                                color='blue'
                                name="Safety"
                                size={20}
                            />
                        )}
                        disable={joinedRoom.current}

                    />
                </View>
            </View>

            <View style={styles.shrinkingContainer}>
                {
                    !isJoin ? (
                        <Button
                            onPress={joinRoom}
                            title="join"
                        />
                    ) : null
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
                    title={isShareScreen ? "Start Screen Share" : " Stop Screen Share"}
                >
                </Button>



            </View>

        </KeyboardAvoidingView>
    </SafeAreaView>
</View>