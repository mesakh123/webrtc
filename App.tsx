import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
// import CallScreen from './src/screens/CallScreen';
import Demo from './src/screens/Demo';

import Demo5 from './src/screens/Demo5';
import Demo6 from './src/screens/Demo6';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Demo6 />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
