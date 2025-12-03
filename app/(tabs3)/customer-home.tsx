import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
import BannerAdCard from "@/components/banneradcard";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
} from 'react-native';
import AppBar from '@/components/appbar';

// --------------------------------------------------------------------
// STATIC DATA
// --------------------------------------------------------------------
const SKILLS = [
  'Lighting Repair', 'Farming', 'Plumbing', 'Caretaking', 'Tuition', 'Driving',
  'Cooking', 'Sewing', 'Car Wash', 'Construction', 'Cleaning', 'Animal Care',
  'Shop Keeping', 'Tailoring', 'Painting', 'Mechanic', 'Gardening', 'Electrical',
  'Masonry', 'Carpentry', 'House Work',
];

interface JobFinderProfile {
  name: string;
  skills: string[];
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  phoneNumber: string;
}

interface Contract {
  customerPhoneNumber: string;
  jobFinderPhoneNumber: string;
  jobFinderName: string;
  customerAddress: string;
  skill: string;
  status: 'accepted' | 'rejected' | 'pending';
  createdAt: string;
}

interface CustomerProfile {
  name: string;
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  additionalInfo: string;
  contracts: string[];
}

// --------------------------------------------------------------------
// UTIL — Haversine
// --------------------------------------------------------------------
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number | null,
  lon2: number | null
): number | null => {
  if (lat2 === null || lon2 === null) return null;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --------------------------------------------------------------------
// COMPONENT
// --------------------------------------------------------------------
function CustomerHome() {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [jobFinders, setJobFinders] = useState<JobFinderProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);

  const [customerLocation, setCustomerLocation] = useState<{
    lat: number;
    lon: number;
    address: string;
  } | null>(null);

  const router = useRouter();
  const isMounted = useRef(true);

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ------------------------------------------------------------------
  // Fetch customer location
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        setIsLoading(true);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission required');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const geocode = await Location.reverseGeocodeAsync(loc.coords);

        let address = 'Unknown Address';
        if (geocode.length > 0) {
          const p = geocode[0];
          address = `${p.name || ''} ${p.street || ''} ${p.city || ''} ${p.region || ''} ${
            p.postalCode || ''
          }`.trim();
        }

        isMounted.current &&
          setCustomerLocation({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            address,
          });
      } catch (e) {
        console.error('Location error:', e);
      } finally {
        isMounted.current && setIsLoading(false);
      }
    };

    fetchLocation();
  }, []);

  // ------------------------------------------------------------------
  // Fetch matching job finders
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSkill || !customerLocation) return;

    const fetch = async () => {
      try {
        setIsLoading(true);

        const snap = await getDocs(collection(db, 'jobFinderProfiles'));
        const list: JobFinderProfile[] = [];

        snap.forEach(docSnap => {
          const d = docSnap.data();

          if (!Array.isArray(d.skills) || !d.skills.includes(selectedSkill)) return;

          const dist = calculateDistance(
            customerLocation.lat,
            customerLocation.lon,
            d.lat,
            d.lon
          );

          if (dist !== null && dist <= 15) {
            list.push({
              name: d.name ?? 'Unknown',
              location: d.location ?? '',
              pincode: d.pincode ?? '',
              skills: Array.isArray(d.skills) ? d.skills : [],
              phoneNumber: docSnap.id,
              lat: d.lat ?? null,
              lon: d.lon ?? null,
            });
          }
        });

        isMounted.current && setJobFinders(list);
      } catch (e) {
        console.error('Job finder fetch error:', e);
      } finally {
        isMounted.current && setIsLoading(false);
      }
    };

    fetch();
  }, [selectedSkill, customerLocation]);

  // ------------------------------------------------------------------
  // Hire worker
  // ------------------------------------------------------------------
  const handleHire = async (jf: JobFinderProfile) => {
    if (!customerLocation || !selectedSkill) return;

    try {
      setIsLoading(true);

      const phone = await AsyncStorage.getItem('phoneNumber');
      if (!phone) return;

      const contractId = `${phone}_${jf.phoneNumber}`;

      const contract: Contract = {
        customerPhoneNumber: phone,
        jobFinderPhoneNumber: jf.phoneNumber,
        jobFinderName: jf.name,
        customerAddress: customerLocation.address,
        skill: selectedSkill,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'contracts', contractId), contract);

      const ref = doc(db, 'customerProfiles', phone);
      const snap = await getDoc(ref);
      let arr: string[] = [];

      if (snap.exists()) arr = snap.data().contracts || [];
      if (!arr.includes(contractId)) {
        arr.push(contractId);
        await setDoc(ref, { contracts: arr }, { merge: true });
      }

      Alert.alert('Success', 'Contract created successfully!');
    } catch (e) {
      console.error('Hire error:', e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Insert ad cards every 3 items & also at start
const insertAds = (items: any[]) => {
  const result: any[] = [];

  if (items.length === 0) {
    // No workers? Still show 1 ad
    result.push({ type: "ad", id: "ad-0" });
    return result;
  }

  for (let i = 0; i < items.length; i++) {
    if (i % 3 === 0) {
      result.push({ type: "ad", id: "ad-" + i });
    }
    result.push({ type: "item", ...items[i] });
  }

  return result;
};
  const dataWithAds = insertAds(jobFinders);
  // ------------------------------------------------------------------
  // Render worker card
  // ------------------------------------------------------------------
  const renderCard = ({ item }: { item: JobFinderProfile }) => (
    <View style={styles.card}>
      <Text style={styles.cardText}>{item.name}</Text>
      <Text style={styles.cardSubText}>Skills: {item.skills.join(', ')}</Text>
      <Text style={styles.cardSubText}>Location: {item.location}</Text>
      <Text style={styles.cardSubText}>Pincode: {item.pincode}</Text>

      {item.lat && item.lon && customerLocation && (
        <Text style={styles.cardSubText}>
          Distance:{' '}
          {calculateDistance(
            customerLocation.lat,
            customerLocation.lon,
            item.lat,
            item.lon
          )?.toFixed(2)}{' '}
          km
        </Text>
      )}

      <TouchableOpacity style={styles.hireButton} onPress={() => handleHire(item)}>
        <Text style={styles.hireButtonText}>Hire</Text>
      </TouchableOpacity>
    </View>
  );

  // ------------------------------------------------------------------
  // MAIN UI
  // ------------------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <AppBar title="Find Workers" />

      <View style={styles.container}>
        {/* SKILL BUTTON */}
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowSkillModal(true)}
        >
          <Text style={styles.dropdownButtonText}>
            {selectedSkill || 'Select a skill'}
          </Text>
        </TouchableOpacity>

        {/* MODAL DROPDOWN */}
        <Modal visible={showSkillModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalDropdownContainer}>
              <Text style={styles.modalTitle}>Select Skill</Text>

              <ScrollView style={styles.modalScroll} nestedScrollEnabled>
                {SKILLS.map(skill => (
                  <TouchableOpacity
                    key={skill}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedSkill(skill);
                      setShowSkillModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{skill}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSkillModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* LIST */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
        ) : selectedSkill ? (
          <FlatList
            data={dataWithAds}
            keyExtractor={(item, index) => item.id ? item.id : "ad-" + index}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (item.type === "ad") return <BannerAdCard />;
              return renderCard({ item });
            }}
          />
        ) : (
          <Text style={styles.noResults}>Please select a skill to begin.</Text>
        )}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------
// STYLES
// --------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },

  list: { paddingBottom: 20 },

  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 3,
  },

  cardText: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  cardSubText: { fontSize: 14, color: '#555', marginBottom: 3 },

  hireButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  hireButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  noResults: { fontSize: 16, textAlign: 'center', marginTop: 20, color: '#555' },

  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  dropdownButtonText: { fontSize: 16, color: '#333' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalDropdownContainer: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },

  modalScroll: { maxHeight: '70%' },

  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  modalOptionText: { fontSize: 16 },

  modalCancelButton: {
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
});

// ✔ Only ONE export
export default CustomerHome;
