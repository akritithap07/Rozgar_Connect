import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import AppBar from "@/components/appbar";

interface ApplicationItem {
  id: string;
  type: "gig" | "event";
  title: string;
  location: string;
  dateStart?: string;
  dateEnd?: string;
  time?: string;
  status: "pending" | "accepted";
  ngoPhone?: string;   // <-- optional
}
export default function JobFinderApplications() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const safeDate = (iso?: string) => {
    if (!iso) return "N/A";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "N/A" : d.toDateString();
  };

  const safeTime = (iso?: string) => {
    if (!iso) return "N/A";
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    const appUnsubs: { [id: string]: () => void } = {};

    const load = async () => {
      const phone = await AsyncStorage.getItem("phoneNumber");
      if (!phone) return;

      const profileRef = doc(db, "jobFinderProfiles", phone);

      // LIVE LISTENER FOR PROFILE
      profileUnsub = onSnapshot(profileRef, (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        const appliedIds: string[] = data.myApplications || [];

        // Remove listeners for deleted applications
        Object.keys(appUnsubs).forEach((id) => {
          if (!appliedIds.includes(id)) {
            appUnsubs[id]();
            delete appUnsubs[id];
          }
        });

        const updatedApps: ApplicationItem[] = [];

        appliedIds.forEach((id) => {
          // Already listening? Skip
          if (appUnsubs[id]) return;

          // Listen to gig
          const gigRef = doc(db, "gigs", id);
          appUnsubs[id] = onSnapshot(gigRef, (gSnap) => {
            if (gSnap.exists()) {
              const g: any = gSnap.data();
              const accepted =
                Array.isArray(g.acceptedApplicants) &&
                g.acceptedApplicants.includes(phone);

              updatedApps.push({
                id,
                type: "gig",
                title: g.jobDescription,
                location: g.address || "N/A",
                dateStart: safeDate(g.dateStart),
                dateEnd: safeDate(g.dateEnd),
                time: safeTime(g.time),
                status: accepted ? "accepted" : "pending",
              });

              setApplications((prev) => {
                const filtered = prev.filter((p) => p.id !== id);
                return [...filtered, updatedApps[updatedApps.length - 1]];
              });

              return;
            }

            // Listen to event
            const eventRef = doc(db, "events", id);
            appUnsubs[id] = onSnapshot(eventRef, (eSnap) => {
              if (!eSnap.exists()) return;

              const e: any = eSnap.data();
              const accepted =
                Array.isArray(e.acceptedApplicants) &&
                e.acceptedApplicants.includes(phone);

              updatedApps.push({
                id,
                type: "event",
                title: e.name || "Event",
                location: e.location || "N/A",
                dateStart: safeDate(e.startDate),
                dateEnd: safeDate(e.endDate),
                time:
                  safeTime(e.timeFrom) +
                  " - " +
                  safeTime(e.timeTo),
                status: accepted ? "accepted" : "pending",
                ngoPhone: e.contact || "N/A",   // <-- ADD THIS
              });

              setApplications((prev) => {
                const filtered = prev.filter((p) => p.id !== id);
                return [...filtered, updatedApps[updatedApps.length - 1]];
              });
            });
          });
        });

        setLoading(false);
      });
    };

    load();

    return () => {
      if (profileUnsub) profileUnsub();
      Object.values(appUnsubs).forEach((fn) => fn());
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <AppBar title="My Applications" />
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.title} ({item.type.toUpperCase()})
            </Text>

            <Text style={styles.detail}>Location: {item.location}</Text>

            <Text style={styles.detail}>
              Date: {item.dateStart}
              {item.dateEnd !== item.dateStart ? " → " + item.dateEnd : ""}
            </Text>

            <Text style={styles.detail}>Time: {item.time}</Text>

            {/* Show only if event */}
            {item.type === "event" && (
              <Text style={styles.detail}>NGO Contact: {item.ngoPhone}</Text>
            )}

            <Text
              style={[
                styles.status,
                item.status === "accepted"
                  ? { color: "#28a745" }
                  : { color: "#f39c12" },
              ]}
            >
              Status: {item.status.toUpperCase()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
  detail: { fontSize: 14, color: "#555", marginBottom: 4 },
  status: { fontSize: 16, fontWeight: "bold", marginTop: 8 },
});
