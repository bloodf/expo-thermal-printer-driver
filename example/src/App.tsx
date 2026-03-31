import { Text, View, StyleSheet } from 'react-native';
import ThermalPrinter, {
  cut,
  feed,
  line,
  text,
} from 'react-native-thermal-printer-driver';

const receiptPreview = [text('Thermal printer ready'), line(), feed(1), cut()];
const isApiLoaded = typeof ThermalPrinter.print === 'function';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Thermal printer driver example</Text>
      <Text>API loaded: {isApiLoaded ? 'yes' : 'no'}</Text>
      <Text>Sample receipt nodes: {receiptPreview.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
