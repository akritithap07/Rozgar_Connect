import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import i18n from '@/constants/i18n';
import AppBar from '@/components/appbar';

interface VendorProfile {
  name: string;
  company: string;
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  myGigs: string[];
}

export default function VendorProfile() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const router = useRouter();

  const isRequiredInvalid = (value: string) =>
    submitAttempted && (!value || value.trim().length === 0);

  // ------------------------------------------------
  // Load existing profile + auto location
  // ------------------------------------------------
  useEffect(() => {
    const loadProfileAndLocation = async () => {
      try {
        const phoneNumber = await AsyncStorage.getItem('phoneNumber');
        if (!phoneNumber) {
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('phone_not_found', {
              defaultValue: 'Phone number not found. Please log in again.',
            })
          );
          router.replace('/login');
          return;
        }

        // Load existing profile
        const profileDocRef = doc(db, 'vendorProfiles', phoneNumber);
        const profileSnap = await getDoc(profileDocRef);

        if (profileSnap.exists()) {
          const profile = profileSnap.data() as VendorProfile;
          setName(profile.name || '');
          setCompany(profile.company || '');
          setLocation(profile.location || '');
          setPincode(profile.pincode || '');
          setLat(profile.lat ?? null);
          setLon(profile.lon ?? null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }

      // Auto-location
      try {
        setIsLoadingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            i18n.t('permission_denied', { defaultValue: 'Permission Denied' }),
            i18n.t('location_permission_required', {
              defaultValue:
                'Location permission is required to autofill address and pincode.',
            })
          );
          setIsLoadingLocation(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        // Set raw coords first
        setLat(loc.coords.latitude);
        setLon(loc.coords.longitude);

        const geocode = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        if (geocode.length > 0) {
          const place = geocode[0];
          const newLocation = `${place.name || ''} ${place.street || ''} ${place.city || ''} ${place.region || ''}`.trim();
          setLocation(newLocation);
          setPincode(place.postalCode || '');
        }
      } catch (error) {
        console.error('Location fetch error:', error);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    loadProfileAndLocation();
  }, [router]);

  // ------------------------------------------------
  // Debounced geocoding (Method A)
  // ------------------------------------------------
  const debouncedGeocode = useCallback(
    (() => {
      let timeout: any;

      return (loc: string, pin: string) => {
        if (!loc || !pin || pin.length !== 6) {
          setLat(null);
          setLon(null);
          return;
        }

        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(async () => {
          try {
            setGeoLoading(true);
            const encoded = encodeURIComponent(loc + ' ' + pin);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`;

            const response = await fetch(url, {
              headers: { 'User-Agent': 'RozgarConnectApp/1.0' },
            });

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              setLat(parseFloat(data[0].lat));
              setLon(parseFloat(data[0].lon));
            } else {
              setLat(null);
              setLon(null);
            }
          } catch (error) {
            console.error('Geocoding error:', error);
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

  // Trigger geocoding whenever location or pincode changes
  useEffect(() => {
    if (location && pincode) {
      debouncedGeocode(location, pincode);
    }
  }, [location, pincode, debouncedGeocode]);

  // ------------------------------------------------
  // Submit enabled state
  // ------------------------------------------------
  const submitDisabled =
    !name ||
    !company ||
    !location ||
    !pincode ||
    !/^\d{6}$/.test(pincode) ||
    lat === null ||
    lon === null ||
    geoLoading ||
    isLoadingLocation ||
    isSubmitting;

  // ------------------------------------------------
  // Save handler
  // ------------------------------------------------
  const onSave = async () => {
    setSubmitAttempted(true);

    if (submitDisabled) {
      Alert.alert(
        i18n.t('validation_error', { defaultValue: 'Validation Error' }),
        i18n.t('fill_all_fields', { defaultValue: 'Please fill all fields correctly' })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      if (!phoneNumber) {
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('phone_not_found', {
            defaultValue: 'Phone number not found. Please log in again.',
          })
        );
        router.replace('/login');
        return;
      }

      // Preserve existing myGigs
      const profileRef = doc(db, 'vendorProfiles', phoneNumber);
      const oldSnap = await getDoc(profileRef);

      const existingGigs =
        oldSnap.exists() && Array.isArray(oldSnap.data().myGigs)
          ? oldSnap.data().myGigs
          : [];

      const profile: VendorProfile = {
        name,
        company,
        location,
        pincode,
        lat,
        lon,
        myGigs: existingGigs,
      };

      await setDoc(profileRef, profile, { merge: true });
      await AsyncStorage.setItem('isNewUser', 'false');

      await updateDoc(doc(db, 'users', phoneNumber), {
        isNewUser: false,
      });

      Alert.alert(
        i18n.t('success', { defaultValue: 'Success' }),
        i18n.t('profile_saved', {
          defaultValue: 'Profile saved successfully',
        }),
        [
          {
            text: i18n.t('ok', { defaultValue: 'OK' }),
            onPress: () => router.push('/(tabs)/applications'),
          },
        ]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('save_failed', {
          defaultValue: 'Failed to save profile. Please try again.',
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppBar title="Vendor Profile" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>

          <Text style={styles.label}>
            {i18n.t('name', { defaultValue: 'Name' })}
          </Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(name) && styles.inputError]}
            value={name}
            onChangeText={setName}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>
            {i18n.t('enter_company_name', { defaultValue: 'Company Name' })}
          </Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(company) && styles.inputError]}
            value={company}
            onChangeText={setCompany}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>
            {isLoadingLocation
              ? i18n.t('fetching_location', { defaultValue: 'Fetching location...' })
              : i18n.t('location', { defaultValue: 'Location' })}
          </Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(location) && styles.inputError]}
            value={location}
            onChangeText={setLocation}
            editable={!isLoadingLocation && !isSubmitting}
          />

          <Text style={styles.label}>
            {isLoadingLocation
              ? i18n.t('fetching_pincode', { defaultValue: 'Fetching pincode...' })
              : i18n.t('pincode', { defaultValue: 'Pincode' })}
          </Text>
          <TextInput
            style={[styles.input, isRequiredInvalid(pincode) && styles.inputError]}
            value={pincode}
            onChangeText={setPincode}
            keyboardType="numeric"
            maxLength={6}
            editable={!isLoadingLocation && !isSubmitting}
          />

          <TouchableOpacity
            style={[styles.buttonSubmit, submitDisabled && styles.buttonSubmitDisabled]}
            onPress={onSave}
            disabled={submitDisabled}
          >
            {(isSubmitting || geoLoading) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {i18n.t('submit', { defaultValue: 'Submit' })}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  formContainer: ViewStyle;
  heading: TextStyle;
  input: TextStyle;
  inputError: TextStyle;
  label: TextStyle;
  buttonSubmit: ViewStyle;
  buttonSubmitDisabled: ViewStyle;
  buttonText: TextStyle;
}>({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingBottom: 100,
  },
  formContainer: {
    width: '100%',
    padding: 20,
    maxWidth: 400,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#e53935',
  },
  buttonSubmit: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonSubmitDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
