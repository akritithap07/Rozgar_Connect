import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/firebase";
import i18n from "@/constants/i18n";
import AppBar from "@/components/appbar";
import BannerAdCard from "@/components/banneradcard";

// ---------- TYPES ----------
interface Gig {
  id: string;
  vendorPhoneNumber: string;
  imageUri: string;
  jobDescription: string;
  dateStart: string;
  dateEnd: string;
  time: string;
  numPeople: number;
  additionalInfo: string;
  address?: string;
  pincode?: string;
  lat: number | null;
  lon: number | null;
  applicants: string[];
  acceptedApplicants: string[];
  createdAt: string;
}

interface Event {
  id: string;
  imageUri: string;
  name: string;
  regID: string;
  contact: string;
  theme: string;
  startDate: string;
  endDate: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  pincode?: string;
  numVolunteers: number;
  additionalInfo: string;
  lat: number | null;
  lon: number | null;
  applicants?: string[];
  createdAt: string;
}

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

// ---------- UTIL ----------
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// =========================================================
//                    MAIN COMPONENT
// =========================================================

export default function FindGigs() {
  const [mode, setMode] = useState<"gigs" | "events">("gigs");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRadius, setFilterRadius] = useState("10km");
  const [modalVisible, setModalVisible] = useState(false);

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [jobFinderPhone, setJobFinderPhone] = useState<string | null>(null);
  const [jobFinderLocation, setJobFinderLocation] = useState({
    lat: null as number | null,
    lon: null as number | null,
  });

  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<{ [key: string]: boolean }>({});

  // ---------- LOAD ----------
  useEffect(() => {
    let unsubGigs: any = null;
    let unsubEvents: any = null;

    const load = async () => {
      try {
        setLoading(true);

        const phone = await AsyncStorage.getItem("phoneNumber");
        if (!phone) return;
        setJobFinderPhone(phone);

        // profile
        const pSnap = await getDoc(doc(db, "jobFinderProfiles", phone));
        if (pSnap.exists()) {
          const d = pSnap.data() as JobFinderProfile;
          setJobFinderLocation({ lat: d.lat, lon: d.lon });
        }

        // gigs
        unsubGigs = onSnapshot(collection(db, "gigs"), (snap) => {
          const arr: Gig[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
            applicants: Array.isArray(d.data().applicants)
              ? d.data().applicants
              : [],
            acceptedApplicants: Array.isArray(d.data().acceptedApplicants)
              ? d.data().acceptedApplicants
              : [],
          }));
          setGigs(arr);
        });

        // events
        unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
          const arr: Event[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
            applicants: Array.isArray(d.data().applicants) ? d.data().applicants : [],
          }));
          setEvents(arr);
        });
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (unsubGigs) unsubGigs();
      if (unsubEvents) unsubEvents();
    };
  }, []);

  // ---------- APPLY for gigs ----------
  const onApply = async (gigId: string) => {
    if (!jobFinderPhone) return;

    setApplying((p) => ({ ...p, [gigId]: true }));

    try {
      const ref = doc(db, "gigs", gigId);
      const snap = await getDoc(ref);

      if (!snap.exists()) return;

      const d = snap.data();
      const applicants = Array.isArray(d.applicants) ? d.applicants : [];

      if (applicants.includes(jobFinderPhone)) {
        Alert.alert("Already applied");
        return;
      }

      await updateDoc(ref, {
        applicants: arrayUnion(jobFinderPhone),
      });

      await updateDoc(doc(db, "jobFinderProfiles", jobFinderPhone), {
        myApplications: arrayUnion(gigId),
      });
    } finally {
      setApplying((p) => ({ ...p, [gigId]: false }));
    }
  };
  const insertAds = (items: any[]) => {
  const result: any[] = [];

  if (items.length === 0) {
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

  // ---------- APPLY for events ----------
  const onApplyEvent = async (eventId: string) => {
    if (!jobFinderPhone) return;

    setApplying((p) => ({ ...p, [eventId]: true }));

    try {
      const ref = doc(db, "events", eventId);
      const snap = await getDoc(ref);

      if (!snap.exists()) return;

      const d = snap.data();
      const applicants = Array.isArray(d.applicants) ? d.applicants : [];

      if (applicants.includes(jobFinderPhone)) {
        Alert.alert("Already applied");
        return;
      }

      await updateDoc(ref, {
        applicants: arrayUnion(jobFinderPhone),
      });

      await updateDoc(doc(db, "jobFinderProfiles", jobFinderPhone), {
        myApplications: arrayUnion(eventId),
      });
    } finally {
      setApplying((p) => ({ ...p, [eventId]: false }));
    }
  };

  // ---------- FILTER ----------
  const filterData = (arr: any[]) => {
    return arr.filter((item) => {
      const combined =
        `${item.name || item.jobDescription || ""} ${item.theme || ""} ${item.additionalInfo || ""}`
          .toLowerCase();

      if (!combined.includes(searchQuery.toLowerCase())) return false;

      const lat1 = jobFinderLocation.lat;
      const lon1 = jobFinderLocation.lon;

      if (lat1 === null || lon1 === null) return true;
      if (item.lat === null || item.lon === null) return false;

      const distance = haversineDistance(lat1, lon1, item.lat, item.lon);
      const radiusKm = parseFloat(filterRadius.replace("km", ""));

      return distance <= radiusKm;
    });
  };

  const finalGigs = filterData(gigs);
  const finalEvents = filterData(events);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  // ---------- RENDER GIG ----------
  const renderGig = ({ item }: { item: Gig }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.jobDescription}</Text>

      <Text style={styles.cardDetail}>Location: {item.address || "N/A"}</Text>

      <Text style={styles.cardDetail}>
        Start: {new Date(item.dateStart).toDateString()}
      </Text>

      <Text style={styles.cardDetail}>
        End: {new Date(item.dateEnd).toDateString()}
      </Text>

      <Text style={styles.cardDetail}>
        Time:{" "}
        {new Date(item.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>

      <Text style={styles.cardDetail}>People Required: {item.numPeople}</Text>

      <TouchableOpacity
        style={styles.applyButton}
        onPress={() => onApply(item.id)}
      >
        <Text style={styles.applyButtonText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );

        const dataWithAds =
          mode === "gigs"
            ? insertAds(finalGigs)
            : insertAds(finalEvents);

  // ---------- RENDER EVENT ----------
  const renderEvent = ({ item }: { item: Event }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.name}</Text>

      <Text style={styles.cardDetail}>Theme: {item.theme}</Text>
      <Text style={styles.cardDetail}>Location: {item.location}</Text>

      <Text style={styles.cardDetail}>
        Start: {new Date(item.startDate).toDateString()}
      </Text>

      <Text style={styles.cardDetail}>
        End: {new Date(item.endDate).toDateString()}
      </Text>

      <Text style={styles.cardDetail}>
        Time:{" "}
        {new Date(item.timeFrom).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        —{" "}
        {new Date(item.timeTo).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>

      <Text style={styles.cardDetail}>
        Volunteers Required: {item.numVolunteers}
      </Text>

      {/* APPLY BUTTON */}
      <TouchableOpacity
        style={styles.applyButton}
        onPress={() => onApplyEvent(item.id)}
        disabled={applying[item.id]}
      >
        {applying[item.id] ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.applyButtonText}>Apply</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ---------- UI ----------
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <AppBar title="Explore" />
      <View style={styles.container}>
        {/* Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "gigs" && styles.toggleButtonActive,
            ]}
            onPress={() => setMode("gigs")}
          >
            <Text
              style={[
                styles.toggleButtonText,
                mode === "gigs" && styles.toggleButtonTextActive,
              ]}
            >
              Gigs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "events" && styles.toggleButtonActive,
            ]}
            onPress={() => setMode("events")}
          >
            <Text
              style={[
                styles.toggleButtonText,
                mode === "events" && styles.toggleButtonTextActive,
              ]}
            >
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.header}>
          <TextInput
            style={styles.searchBar}
            placeholder={mode === "gigs" ? "Search gigs..." : "Search events..."}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Ionicons name="filter" size={24} color="#007bff" />
          </TouchableOpacity>
        </View>

        {/* List */}

        <FlatList
          data={dataWithAds}
          keyExtractor={(item, index) => item.id + "-" + index}
          renderItem={({ item }) => {
            if (item.type === "ad") return <BannerAdCard />;

            if (mode === "gigs") return renderGig({ item });
            return renderEvent({ item });
          }}
        />

        {/* Radius Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Filter by Radius</Text>

              {["5km", "10km", "15km"].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.modalOption,
                    filterRadius === r && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setFilterRadius(r);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      filterRadius === r && { color: "#fff" },
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
      <View style={{ height: 60 }} />
    </View>
  );
}

// =========================================================
//                       STYLES
// =========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ---- Toggle ----
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#007bff22",
    borderColor: "#007bff",
  },
  toggleButtonText: { fontSize: 16, color: "#444" },
  toggleButtonTextActive: { color: "#007bff", fontWeight: "bold" },

  // ---- Search ----
  header: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    borderColor: "#ccc",
    marginRight: 12,
  },

  // ---- Cards ----
  card: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "bold" },
  cardDetail: { marginTop: 4, color: "#666" },

  applyButton: {
    marginTop: 10,
    backgroundColor: "#007bff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  // ---- Modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    width: 280,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  modalOption: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#f2f2f2",
  },
  modalOptionSelected: {
    backgroundColor: "#007bff",
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCancelText: {
    marginTop: 8,
    color: "#007bff",
    fontSize: 16,
  },
});

