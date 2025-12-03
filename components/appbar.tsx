import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppBarProps {
  title: string;
  onBack?: () => void; // optional
}

export default function AppBar({ title, onBack }: AppBarProps) {
  return (
    <View style={styles.appBar}>
      
      {/* Back Button (optional) */}
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Right placeholder for symmetry */}
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: {
    height: 120,
    paddingTop: 50,
    backgroundColor: '#007bff',
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,

    // 🔥 Stronger, more visible shadow
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 10, // make sure it draws above content
    },

  backButton: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  placeholder: {
    width: 40,
    marginLeft: 10,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
});
