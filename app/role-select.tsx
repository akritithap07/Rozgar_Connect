import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RoleSelect() {
  const handleSelect = async (role: 'jobfinder' | 'vendor' | 'customer' | 'ngo') => {
    await AsyncStorage.setItem('userRole', role);
    router.replace('/set-pin');
  };

  return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>

    <AppBar title={i18n.t('select_role', { defaultValue: 'Select Role' })} />

    <View style={styles.container}>

      <View style={styles.grid}>
        
        {/* Vendor */}
        <TouchableOpacity style={styles.card} onPress={() => handleSelect('vendor')}>
          <Image source={require('../assets/images/vendor.png')} style={styles.image} />
          <Text style={styles.label}>{i18n.t('vendor', { defaultValue: 'Vendor' })}</Text>
        </TouchableOpacity>

        {/* Job Finder */}
        <TouchableOpacity style={styles.card} onPress={() => handleSelect('jobfinder')}>
          <Image source={require('../assets/images/finder.png')} style={styles.image} />
          <Text style={styles.label}>{i18n.t('job_finder', { defaultValue: 'Job Finder' })}</Text>
        </TouchableOpacity>

        {/* Customer */}
        <TouchableOpacity style={styles.card} onPress={() => handleSelect('customer')}>
          <Image source={require('../assets/images/customer.png')} style={styles.image} />
          <Text style={styles.label}>{i18n.t('customer', { defaultValue: 'Customer' })}</Text>
        </TouchableOpacity>

        {/* NGO */}
        <TouchableOpacity style={styles.card} onPress={() => handleSelect('ngo')}>
          <Image source={require('../assets/images/ngo.png')} style={styles.image} />
          <Text style={styles.label}>{i18n.t('ngo', { defaultValue: 'NGO' })}</Text>
        </TouchableOpacity>

      </View>
    </View>

  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  heading: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },

  grid: {
    width: "90%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },

  card: {
    width: "47%",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 20,
    elevation: 3,
  },

  image: {
    width: 90,
    height: 90,
    marginBottom: 12,
    borderRadius: 45,
    backgroundColor: "#eef",
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
  },

  label: {
    fontSize: 18,
    marginTop: 6,
    fontWeight: "500",
  },
});

