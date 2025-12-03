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

const SKILLS = [
  "Lighting Repair", "Farming", "Plumbing", "Caretaking", "Tuition", "Driving",
  "Cooking", "Sewing", "Car Wash", "Construction", "Cleaning", "Animal Care",
  "Shop Keeping", "Tailoring", "Painting", "Mechanic", "Gardening", "Electrical",
  "Masonry", "Carpentry", "House Work"
].sort();

interface JobFinderProfile {
  name: string;
  age: string;
  gender: string;
  skills: string[];
  experience: string;
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  additionalInfo: string;
  myApplications: string[];
}

export default function JobFinderProfileCreate() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState('');

  const [location, setLocation] = useState('');
  const [pincode, setPincode] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [skillsDropdownVisible, setSkillsDropdownVisible] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEdited, setUserEdited] = useState(false);

  // -----------------------------------
  // Load existing profile + auto-locate
  // -----------------------------------
  useEffect(() => {
    const init = async () => {
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      if (!phoneNumber) {
        Alert.alert("Error", "Missing phone number");
        router.replace('/login');
        return;
      }

      // Load existing profile
      try {
        const ref = doc(db, "jobFinderProfiles", phoneNumber);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const p = snap.data() as JobFinderProfile;
          setName(p.name);
          setAge(p.age);
          setGender(p.gender);
          setSkills(p.skills);
          setExperience(p.experience);
          setLocation(p.location);
          setPincode(p.pincode);
          setAdditionalInfo(p.additionalInfo);
        }
      } catch (e) {
        console.log("Load profile error", e);
      }

      // Auto location from device
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync(pos.coords);

        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);

        if (geo.length > 0) {
          const g = geo[0];
          setLocation(`${g.name || ""} ${g.street || ""} ${g.city || ""} ${g.region || ""}`.trim());
          setPincode(g.postalCode || "");
        }
      } catch (e) {
        console.log("Auto location failed:", e);
      }
    };

    init();
  }, [router]);

  // -----------------------------------
  // Debounced forward geocoding
  // -----------------------------------
  useEffect(() => {
    if (!userEdited) return;

    if (!location.trim()) {
      setLat(null);
      setLon(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setGeoLoading(true);

      try {
        const query = encodeURIComponent(location + " " + pincode);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}`,
          { headers: { "User-Agent": "RozgarApp/1.0" } }
        );

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

  const toggleSkill = (skill: string) => {
    setSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  // -----------------------------------
  // Validation / Submit
  // -----------------------------------
  const canSubmit =
    name.trim() !== '' &&
    /^\d+$/.test(age) &&
    Number(age) >= 18 &&
    Number(age) <= 99 &&
    gender.trim() !== '' &&
    skills.length > 0 &&
    experience.trim() !== '' &&
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
      const phone = await AsyncStorage.getItem('phoneNumber');
      if (!phone) return;

      const profile: JobFinderProfile = {
        name,
        age,
        gender,
        skills,
        experience,
        location,
        pincode,
        lat,
        lon,
        additionalInfo,
        myApplications: [],
      };

      await setDoc(doc(db, "jobFinderProfiles", phone), profile);
      await AsyncStorage.setItem("isNewUser", "false");

      await updateDoc(doc(db, "users", phone), {
        isNewUser: false,
      });

      setModalVisible(true);
    } catch (e) {
      console.log("Save failed", e);
      Alert.alert("Error", "Failed to save profile");
    }

    setIsSubmitting(false);
  };

  const closeModal = () => {
    setModalVisible(false);
    router.push('/(tabs2)/find-gigs');
  };

  // -----------------------------------
  // RENDER
  // -----------------------------------
  return (
    <>
      <AppBar title="Create Profile" />

      <ScrollView contentContainerStyle={styles.container}>

        {/* NAME */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Name:</Text>
          <TextInput
            style={styles.inputBox}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* AGE */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Age:</Text>
          <TextInput
            style={styles.inputBox}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />
        </View>

        {/* GENDER */}
          <View style={styles.row}>
            <Text style={styles.label}>Gender:</Text>

            <View style={styles.rightWrap}>
              {['Male', 'Female', 'Others'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.option, gender === g && styles.optionSelected]}
                  onPress={() => setGender(g)}
                >
                  <Text style={gender === g ? styles.optionTextSelected : styles.optionText}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>


        {/* SKILLS */}
        <View style={styles.row}>
          <Text style={styles.label}>Skills:</Text>

          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.dropdownButton, { marginBottom: 0 }]}
              onPress={() => setSkillsDropdownVisible(true)}
            >
              <Text style={styles.dropdownButtonText} numberOfLines={1}>
                {skills.length > 0 ? skills.join(", ") : "Select skills"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* SKILLS MODAL */}
        <Modal visible={skillsDropdownVisible} transparent animationType="fade">
          <View style={styles.dropdownOverlay}>
            <View style={styles.dropdownContainer}>
              <ScrollView style={{ maxHeight: 300 }}>
                {SKILLS.map(skill => {
                  const sel = skills.includes(skill);
                  return (
                    <TouchableOpacity
                      key={skill}
                      style={[styles.dropdownItem, sel && styles.dropdownItemSelected]}
                      onPress={() => toggleSkill(skill)}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          sel && styles.dropdownItemTextSelected
                        ]}
                      >
                        {skill}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.dropdownCancel}
                onPress={() => setSkillsDropdownVisible(false)}
              >
                <Text style={styles.dropdownCancelText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* EXPERIENCE */}
        <View style={styles.expRow}>
          <Text style={styles.label}>Experience:</Text>

          <View style={styles.rightWrap}>
            {['0-5', '5+'].map((exp, i) => (
              <TouchableOpacity
                key={exp}
                style={[
                  styles.expOption,
                  i === 1 && { marginRight: 0 },
                  experience === exp && styles.optionSelected
                ]}
                onPress={() => setExperience(exp)}
              >
                <Text style={experience === exp ? styles.optionTextSelected : styles.optionText}>
                  {exp}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>


        {/* LOCATION */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Location:</Text>
          <TextInput
            style={[styles.inputBox, { height: 80 }]}
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
            onChangeText={(t) => {
              setUserEdited(true);
              setPincode(t);
            }}
            keyboardType="numeric"
            maxLength={6}
          />
        </View>

        {/* INFO */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Info:</Text>
          <TextInput
            style={[styles.inputBox, { height: 80 }]}
            value={additionalInfo}
            multiline
            onChangeText={setAdditionalInfo}
          />
        </View>

        {/* SUBMIT */}
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.submitButton, !canSubmit && { opacity: 0.5 }]}
        >
          {(isSubmitting || geoLoading) ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>

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

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    paddingBottom: 100,
  },

  inputRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },

  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 10,
    width: 85,          // <-- compact label
  },

  inputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    flex:1,
    justifyContent:"flex-start"
  },

    option: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginRight: 5,
    justifyContent: "center",
    flexShrink: 1,      // <-- This is the magic line
  },
  optionSelected: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  optionText: { color: "#000"},
  optionTextSelected: { color: "#fff", fontWeight: "bold"},

  // Skills dropdown
  dropdownButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  dropdownButtonText: { fontSize: 16 },

  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  dropdownContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },

  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownItemSelected: { backgroundColor: "#007bff22" },

  dropdownItemText: { fontSize: 16 },
  dropdownItemTextSelected: { fontSize: 16, fontWeight: "bold", color: "#007bff" },

  dropdownCancel: {
    marginTop: 14,
    backgroundColor: "#007bff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  dropdownCancelText: { color: "#fff", fontWeight: "bold" },

  submitButton: {
    marginTop: 20,
    backgroundColor: "#007bff",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    alignItems: "center",
  },
  modalText: { fontSize: 20, marginBottom: 20 },

  modalButton: {
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  inlineGroup: {
  flexDirection: "row",
  flexShrink: 1,
  flexWrap: "nowrap",
},
expRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 16,
},

expButtons: {
  flexDirection: "row",
  flex: 1,
  justifyContent: "space-between",
},

expOption: {
  flex: 1,                        // <-- TAKE EQUAL WIDTH
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 10,
  marginRight: 10,
  alignItems: "center",
},
rightWrap: {
  flex: 1,
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
},
});
