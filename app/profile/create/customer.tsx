import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface CustomerProfile {
  name: string;
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  additionalInfo: string;
  contracts: string[];
}

export default function CustomerProfileCreate() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [additionalInfo, setAdditionalInfo] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userEdited, setUserEdited] = useState(false); // Track user edits

  // --------------------------
  //  AUTO FETCH PROFILE + LOCATION
  // --------------------------
  useEffect(() => {
    const init = async () => {
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      if (!phoneNumber) {
        Alert.alert(i18n.t('error', { defaultValue: 'Error' }), "Phone number missing");
        router.replace('/login');
        return;
      }

      // LOAD SAVED PROFILE
      try {
        const ref = doc(db, 'customerProfiles', phoneNumber);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const p = snap.data() as CustomerProfile;
          setName(p.name);
          setLocation(p.location);
          setPincode(p.pincode);
          setAdditionalInfo(p.additionalInfo || '');
        }
      } catch {}

      // AUTO LOCATION
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync(pos.coords);

        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);

        if (geo.length > 0) {
          const g = geo[0];
          const addr = `${g.name || ''} ${g.street || ''} ${g.city || ''} ${g.region || ''}`.trim();
          setLocation(addr);
          setPincode(g.postalCode || '');
        }
      } catch (e) {
        console.log("Auto-location failed:", e);
      }
    };

    init();
  }, []);

  // ---------------------------------------
  //   DEBOUNCED GEOCODING WHEN USER EDITS
  // ---------------------------------------
  useEffect(() => {
    if (!userEdited) return; // Ignore initial auto-location

    if (!location.trim()) {
      setLat(null);
      setLon(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setGeoLoading(true);

      try {
        const query = encodeURIComponent(location + ' ' + pincode);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}`,
          { headers: { "User-Agent": "RozgarConnectApp/1.0" } }
        );

        if (!res.ok) throw new Error("Geocode failed");

        const data = await res.json();

        if (data.length > 0) {
          setLat(parseFloat(data[0].lat));
          setLon(parseFloat(data[0].lon));
        } else {
          setLat(null);
          setLon(null);
        }
      } catch (e) {
        setLat(null);
        setLon(null);
      }

      setGeoLoading(false);
    }, 700);

    return () => clearTimeout(timeout);
  }, [location, pincode]);

  // --------------------------
  //    SUBMIT LOGIC
  // --------------------------
  const canSubmit =
    name.trim() !== '' &&
    location.trim() !== '' &&
    /^\d{6}$/.test(pincode) &&
    lat !== null &&
    lon !== null &&
    !geoLoading &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      if (!phoneNumber) return;

      const profile: CustomerProfile = {
        name,
        location,
        pincode,
        additionalInfo,
        lat,
        lon,
        contracts: []
      };

      await setDoc(doc(db, "customerProfiles", phoneNumber), profile);

      await updateDoc(doc(db, "users", phoneNumber), {
        isNewUser: false,
      });

      await AsyncStorage.setItem("isNewUser", "false");
      setModalVisible(true);
    } catch (e) {
      console.error(e);
      Alert.alert("Save failed");
    }

    setIsSubmitting(false);
  };

  const closeModal = () => {
    setModalVisible(false);
    router.push('/customer-home');
  };

  // --------------------------
  // RENDER
  // --------------------------
  return (
    <>
      <AppBar title="Create Profile" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        
        {/* NAME */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Name:</Text>
          <TextInput
            style={styles.inputBox}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* LOCATION */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Location:</Text>
          <TextInput
            style={[styles.inputBox, { height: 70 }]}
            value={location}
            multiline
            onChangeText={(t) => {
              setUserEdited(true);
              setLocation(t);
            }}
          />
        </View>

        {/* PINCODE */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Pincode:</Text>
          <TextInput
            style={styles.inputBox}
            value={pincode}
            keyboardType="numeric"
            maxLength={6}
            onChangeText={(t) => {
              setUserEdited(true);
              setPincode(t);
            }}
          />
        </View>

        {/* INFO */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Info:</Text>
          <TextInput
            style={[styles.inputBox, { height: 80 }]}
            multiline
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
          />
        </View>

        {/* SUBMIT */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitButton,
            !canSubmit && { opacity: 0.5 }
          ]}
        >
          {isSubmitting || geoLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>Profile created successfully!</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 100, backgroundColor: "#fff" },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  label: { width: 90, fontWeight: "bold", fontSize: 16 },
  inputBox: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 15, paddingHorizontal: 12 },
  submitButton: {
    marginTop: 30,
    backgroundColor: "#007bff",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  submitButtonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  modalBox: { backgroundColor: "#fff", padding: 30, borderRadius: 12, alignItems: "center" },
  modalText: { fontSize: 20, marginBottom: 20 },
  modalButton: { backgroundColor: "#007bff", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10 },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
  scroll: { flex: 1 },
});
