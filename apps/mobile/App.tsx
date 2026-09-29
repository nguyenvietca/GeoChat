import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GeoChat</Text>
      <Text style={styles.subtitle}>Mobile app skeleton</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: '#e2e8f0',
    fontSize: 32,
    fontWeight: '700'
  },
  subtitle: {
    color: '#a5f3fc',
    fontSize: 18,
    marginTop: 8
  }
});
