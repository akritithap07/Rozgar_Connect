import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState, useCallback } from 'react';
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

const THEME_OPTIONS = [
  'Education',
  'Health',
  'Environment',
  'Women Empowerment',
  'Youth Development',
  'Animal Welfare',
  'Disability Support',
  'Rural Development',
  'Other',
];

export default function NGOProfile() {
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [regID, setRegID] = useState('');
  const [contact, setContact] = useState('');
  const [theme, setTheme] = useState('');

  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');

  const [website, setWebsite] = useState('');

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isRequiredInvalid = (value: string) =>
    submitAttempted && (!value || value.trim().length === 0);

  // ============================================================
  // AUTO-LOCATION ON MOUNT
  // ============================================================
  useEffect(() => {
    const init = async () => {
      try {
        const storedPhone = await AsyncStorage.getItem('phoneNumber');
        if (!storedPhone) {
          Alert.alert('Error', 'Phone number not found.');
          router.replace('/login');
          return;
        }

        setPhoneNumber(storedPhone);
        setContact(storedPhone);

        // Load any previous NGO profile
        const ref = doc(db, 'ngoProfiles', storedPhone);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const p = snap.data();
          setName(p.name || '');
          setRegID(p.regID || '');
          setTheme(p.theme || '');
          setLocation(p.location || '');
          setPincode(p.pincode || '');
          setWebsite(p.website || '');
        }
      } catch (e) {
        console.log('Load error', e);
      }

      // Auto location
      try {
        setIsLoadingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsLoadingLocation(false);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const geo = await Location.reverseGeocodeAsync(pos.coords);

        if (geo.length > 0) {
          const place = geo[0];
          const addr =
            `${place.name || ''} ${place.street || ''} ${place.city || ''} ${place.region || ''}`.trim();
          setLocation(addr);
          setPincode(place.postalCode || '');
        }
      } catch (err) {
        console.log('Auto-location error', err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    init();
  }, [router]);

  // ============================================================
  // DEBOUNCED GEOCODING (METHOD A)
  // ============================================================

  const debouncedGeocode = useCallback(
    (() => {
      let timeout: any;

      return (loc: string, pin: string) => {
        if (!loc || !pin || pin.length !== 6) {
          setLat(null);
          setLon(null);
          return;
        }

        if (timeout) clearTimeout(timeout);

        timeout = setTimeout(async () => {
          try {
            setGeoLoading(true);

            const encoded = encodeURIComponent(loc + ' ' + pin);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`;

            const res = await fetch(url, {
              headers: { 'User-Agent': 'RozgarConnectApp/1.0' },
            });

            const data = await res.json();

            if (data.length > 0) {
              setLat(parseFloat(data[0].lat));
              setLon(parseFloat(data[0].lon));
            } else {
              setLat(null);
              setLon(null);
            }
          } catch (e) {
            console.log('Geocode error', e);
            setLat(null);
            setLon(null);
          } finally {
            setGeoLoading(false);
          }
        }, 700);
      };
    })(),
    []
  );

  const onLocationOrPincodeChange = (loc: string, pin: string) => {
    debouncedGeocode(loc, pin);
  };

  // Trigger geocoding when fields change
  useEffect(() => {
    if (location && pincode) {
      onLocationOrPincodeChange(location, pincode);
    }
  }, [location, pincode]);

  // ============================================================
  // VALIDATION STATE
  // ============================================================
  const submitDisabled =
    !name ||
    !regID ||
    !contact ||
    !theme ||
    !location ||
    !pincode ||
    pincode.length !== 6 ||
    lat === null ||
    lon === null ||
    geoLoading ||
    isLoadingLocation ||
    isSubmitting;

  // ============================================================
  // SAVE PROFILE
  // ============================================================
  const saveProfile = async () => {
    setSubmitAttempted(true);

    if (submitDisabled) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const ref = doc(db, 'ngoProfiles', phoneNumber);
      const old = await getDoc(ref);

      const existingEvents =
        old.exists() && Array.isArray(old.data().myEvents)
          ? old.data().myEvents
          : [];

      const profile = {
        name,
        regID,
        contact,
        theme,
        location,
        pincode,
        lat,
        lon,
        ...(website.trim() ? { website: website.trim() } : {}),
        myEvents: existingEvents,
      };

      await setDoc(ref, profile, { merge: true });

      await AsyncStorage.setItem('isNewUser', 'false');
      await updateDoc(doc(db, 'users', phoneNumber), { isNewUser: false });

      Alert.alert('Success', 'Profile saved!', [
        { text: 'OK', onPress: () => router.replace('/ngo-applications' as any) },
      ]);
    } catch (e) {
      console.log('Save error', e);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================
  return (
    <>
      <AppBar title="NGO Profile" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>

          {/* NAME */}
          <Text style={styles.label}>NGO Name</Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(name) && styles.inputError]}
            value={name}
            onChangeText={setName}
          />

          {/* REGISTRATION ID */}
          <Text style={styles.label}>Registration ID</Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(regID) && styles.inputError]}
            value={regID}
            onChangeText={setRegID}
          />

          {/* CONTACT (readonly) */}
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={[styles.input, styles.readonly]}
            value={contact}
            editable={false}
          />

          {/* THEME */}
          <Text style={styles.label}>Theme</Text>
          <TouchableOpacity onPress={() => setShowThemeModal(true)}>
            <TextInput
              style={[styles.input, isRequiredInvalid(theme) && styles.inputError]}
              value={theme}
              placeholder="Select theme"
              editable={false}
            />
          </TouchableOpacity>

          {/* THEME MODAL */}
          <Modal visible={showThemeModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Select Theme</Text>
                {THEME_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.modalOption}
                    onPress={() => {
                      setTheme(opt);
                      setShowThemeModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowThemeModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* LOCATION */}
          <Text style={styles.label}>
            {isLoadingLocation ? 'Fetching location…' : 'Location'}
          </Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(location) && styles.inputError]}
            value={location}
            onChangeText={setLocation}
            editable={!isLoadingLocation}
          />

          {/* PINCODE */}
          <Text style={styles.label}>Pincode</Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(pincode) && styles.inputError]}
            value={pincode}
            onChangeText={setPincode}
            keyboardType="numeric"
            maxLength={6}
          />

          {/* WEBSITE */}
          <Text style={styles.label}>Website (Optional)</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://..."
          />

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.button, submitDisabled && styles.buttonDisabled]}
            onPress={saveProfile}
            disabled={submitDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
    backgroundColor: '#fff',
  },
  formContainer: {
    padding: 20,
    maxWidth: 450,
    width: '100%',
    alignSelf: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  readonly: {
    backgroundColor: '#f1f1f1',
  },
  inputError: {
    borderColor: '#d9534f',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 10,
    backgroundColor: '#eee',
    borderRadius: 8,
    marginBottom: 6,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCancel: {
    marginTop: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007bff',
  },
});
