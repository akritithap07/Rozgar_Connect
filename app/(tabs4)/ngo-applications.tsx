import AppBar from '@/components/appbar';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// -------------------------- TYPES --------------------------

interface JobFinderProfile {
  name: string;
  age: number | string;
  skillset?: string[];
}

interface Applicant {
  phoneNumber: string;
  profile: JobFinderProfile | null;
  status: 'pending' | 'accepted';
}

interface NgoEvent {
  id: string;
  name: string;
  theme?: string;
  startDate?: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  location?: string;
  applicants: Applicant[];
}

// -------------------------- COMPONENT ------------------------

export default function NgoApplications() {
  const [events, setEvents] = useState<NgoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  // Helpers
  const safeFormatDate = (iso?: string): string => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 'N/A' : d.toDateString();
  };

  const safeFormatTime = (iso?: string): string => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? 'N/A'
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // -------------------------- MAIN LISTENER --------------------------

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const init = async () => {
      setLoading(true);

      let phone = await AsyncStorage.getItem('phoneNumber');

      // Retry if storage wasn't ready
      let tries = 0;
      while (!phone && tries < 10) {
        await new Promise(res => setTimeout(res, 100));
        phone = await AsyncStorage.getItem('phoneNumber');
        tries++;
      }

      if (!phone) {
        Alert.alert('Error', 'Phone number not found.');
        setLoading(false);
        return;
      }

      phone = phone.trim();
      console.log("LISTENING FOR EVENTS WHERE ngoPhoneNumber =", phone);

      const q = query(
        collection(db, 'events'),
        where('ngoPhoneNumber', '==', phone)
      );

      unsub = onSnapshot(q, async snap => {
        const allEvents: NgoEvent[] = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();

          // Build applicant objects
          const pending = Array.isArray(data.applicants) ? data.applicants : [];
          const accepted = Array.isArray(data.acceptedApplicants)
            ? data.acceptedApplicants
            : [];

          const allPhones = [...new Set([...pending, ...accepted])];

          const applicantData: Applicant[] = [];

          for (const ph of allPhones) {
            const profRef = doc(db, 'jobFinderProfiles', ph);
            const profSnap = await getDoc(profRef);

            let profile: JobFinderProfile | null = null;

            if (profSnap.exists()) {
              const p = profSnap.data();
              profile = {
                name: p.name,
                age: p.age,
                skillset: p.skillset || [],
              };
            }

            applicantData.push({
              phoneNumber: ph,
              profile,
              status: accepted.includes(ph) ? 'accepted' : 'pending',
            });
          }

          allEvents.push({
            id: docSnap.id,
            name: data.name,
            theme: data.theme,
            startDate: data.startDate,
            endDate: data.endDate,
            timeFrom: data.timeFrom,
            timeTo: data.timeTo,
            location: data.location,
            applicants: applicantData.sort((a, b) =>
              a.status === 'accepted' && b.status === 'pending'
                ? -1
                : a.status === 'pending' && b.status === 'accepted'
                ? 1
                : 0
            ),
          });
        }

        setEvents(allEvents);
        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // -------------------------- ACCEPT / REJECT --------------------------

  const handleAccept = async (eventId: string, phone: string) => {
    const key = `${eventId}-${phone}`;
    setProcessingKey(key);

    try {
      await updateDoc(doc(db, 'events', eventId), {
        applicants: arrayRemove(phone),
        acceptedApplicants: arrayUnion(phone),
      });
    } catch (err) {
      Alert.alert("Error", "Failed to accept volunteer.");
    }

    setProcessingKey(null);
  };

  const handleReject = async (eventId: string, phone: string) => {
    const key = `${eventId}-${phone}`;
    setProcessingKey(key);

    try {
      await updateDoc(doc(db, 'events', eventId), {
        applicants: arrayRemove(phone),
        acceptedApplicants: arrayRemove(phone),
      });
    } catch (err) {
      Alert.alert("Error", "Failed to reject volunteer.");
    }

    setProcessingKey(null);
  };

  // -------------------------- UI RENDER --------------------------

  const renderApplicant = (eventId: string, app: Applicant) => {
    const busy = processingKey === `${eventId}-${app.phoneNumber}`;

    return (
      <View style={styles.applicant}>
        <Text style={styles.applicantName}>
          {app.profile?.name ?? app.phoneNumber}
        </Text>

        {app.status === 'accepted' && (
          <Text style={[styles.detail, { color: '#28a745' }]}>
            Phone: {app.phoneNumber}
          </Text>
        )}

        <Text style={styles.detail}>
          Age: {app.profile?.age ?? 'N/A'}
        </Text>

        <Text style={styles.detail}>
          Skillset: {app.profile?.skillset?.join(', ') || 'N/A'}
        </Text>

        {app.status === 'pending' && (
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => handleAccept(eventId, app.phoneNumber)}
              disabled={busy}
              style={[styles.acceptBtn, busy && { opacity: 0.6 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Accept</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleReject(eventId, app.phoneNumber)}
              disabled={busy}
              style={[styles.rejectBtn, busy && { opacity: 0.6 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reject</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEvent = ({ item }: { item: NgoEvent }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.name}</Text>

      {item.theme && <Text style={styles.detail}>Theme: {item.theme}</Text>}

      <Text style={styles.detail}>
        Date: {safeFormatDate(item.startDate)}
        {item.endDate && item.endDate !== item.startDate
          ? ` → ${safeFormatDate(item.endDate)}`
          : ''}
      </Text>

      <Text style={styles.detail}>
        Time: {safeFormatTime(item.timeFrom)} - {safeFormatTime(item.timeTo)}
      </Text>

      <Text style={styles.detail}>Location: {item.location || 'N/A'}</Text>

      {item.applicants.length ? (
        item.applicants.map(app => (
          <View key={app.phoneNumber}>
            {renderApplicant(item.id, app)}
          </View>
        ))
      ) : (
        <Text style={styles.noApps}>No applicants yet</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <AppBar title="Applications" />
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={renderEvent}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

// -------------------------- STYLES --------------------------

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  detail: { fontSize: 14, color: '#555', marginBottom: 4 },
  noApps: { textAlign: 'center', color: '#777', marginTop: 6 },
  applicant: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  applicantName: { fontSize: 16, fontWeight: 'bold' },
  row: { flexDirection: 'row', marginTop: 6 },
  acceptBtn: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  rejectBtn: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 6,
  },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
