import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';
import { Dropdown } from 'react-native-element-dropdown';
import AntDesign from 'react-native-vector-icons/AntDesign';

export default function CallScreen() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [roomNumber, setRoomNumber] = useState(null);
  const [userId, setUserId] = useState(null);

  const [userType, setUserType] = useState(null);

  const [joinText,setJoinText] = useState("Join");

  const [isJoin,setIsJoin] = useState(false);

  const start = async () => {
    if (!stream) {
      let s;
      try {
        s = await mediaDevices.getUserMedia({ video: true });
        setStream(s);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const stop = () => {
    if (stream) {
      stream.release();
      setStream(null);
    }
  };

  const join =async ()=>{
    if (!stream) {
      let s;
      try {
        s = await mediaDevices.getUserMedia({ video: true });
        setStream(s);
      } catch (e) {
        console.error(e);
      }
      setJoinText("Leave");
      setIsJoin(true);
    }
    else{
      stream.release();
      setStream(null);
      setJoinText("Join");
      setIsJoin(false);
    }
  }


  const userTypeData = [
    { label: 'streamer', value: 'streamer' },
    { label: 'viewer', value: 'viewer' },
  ];
  const [isFocus, setIsFocus] = useState(false);

  return (
    <View style={styles.rootContainer}>
      <View style={{ backgroundColor: '#fff', padding: 12, paddingTop: 25, paddingBottom: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', }}
      >
        <Text style={{ textAlign: 'right', width: '30%', fontSize: 16, color: '#535D76', lineHeight: 24, }}>房间号：</Text>
        <TextInput style={{ flex: 1, fontSize: 16, lineHeight: 24, color: '#363A47' }}
          placeholder='請輸入房间号'
          onChangeText={newValue => setRoomNumber(newValue)}
          value={roomNumber}
          keyboardType='numeric'
          maxLength={10}
          disabled={isJoin} 
        ></TextInput>



      </View>
      <View style={{ backgroundColor: '#fff', paddingBottom: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', }}
      >
        <Text style={{ textAlign: 'right', width: '30%', fontSize: 16, color: '#535D76', lineHeight: 24, }}>user id：</Text>
        <TextInput style={{ flex: 1, fontSize: 16, lineHeight: 24, color: '#363A47' }}
          placeholder='請輸入user id'
          onChangeText={newValue => setUserId(newValue)}
          value={userId}
          maxLength={10}
          keyboardType='numeric'
          disabled={isJoin} 
        ></TextInput>
      </View>

      <View style={styles.container} >
        <Dropdown
          style={[styles.dropdown, isFocus && { borderColor: 'blue' }]}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={userTypeData}
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder={!isFocus ? 'Select item' : '...'}
          searchPlaceholder="Search..."
          value={userType}
          onFocus={() => setIsFocus(true)}
          onBlur={() => setIsFocus(false)}
          onChange={item => {
            setUserType(item.value);
            setIsFocus(false);
          }}
          renderLeftIcon={() => (
            <AntDesign
              style={styles.icon}
              color={isFocus ? 'blue' : 'black'}
              name="Safety"
              size={20}
            />
          )}
          disable={isJoin} 

        />
      </View>
      <View style={styles.footer}>
        <View style={styles.button}>
          <Button title={joinText} onPress={join} />
        </View>
      </View>
      <View style={styles.content}>
        {stream ? (
          <RTCView streamURL={stream.toURL()} style={styles.rtc} />
        ) : (
          <Text style={styles.text}>Press START for video streaming</Text>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.button}>
          <Button title="Start" onPress={start} />
        </View>
        <View style={styles.button}>
          <Button title="Stop" onPress={stop} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  content: {
    flex: 10,
    justifyContent: 'center',
  },
  rtc: {
    flex: 1,
  },
  text: {
    color: '#333',
    textAlign: 'center',
  },
  button: {
    width: '45%',
  },
  footer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 12,
  },
  dropdown: {
    height: 50,
    borderBottomColor: 'gray',
    borderBottomWidth: 0.5,
  },
  icon: {
    marginRight: 5,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
  container: {
    backgroundColor: 'white',
    padding: 5,
  },
  label: {
    position: 'absolute',
    backgroundColor: 'white',
    left: 22,
    top: 8,
    paddingHorizontal: 8,
    fontSize: 14,
  },
});
