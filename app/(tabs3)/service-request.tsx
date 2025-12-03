import i18n from '@/constants/i18n';
import { Text, View, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/firebase';
import AppBar from '@/components/appbar';     // <-- ADDED

interface CustomerProfile {
  name: string;
  location: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  additionalInfo: string;
  contracts: string[];
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

export default function ServiceRequests() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const isMounted = useRef(true);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // Fetch phone number
  useEffect(() => {
    const fetchPhoneNumber = async () => {
      try {
        const storedPhoneNumber = await AsyncStorage.getItem('phoneNumber');
        if (isMounted.current) {
          setPhoneNumber(storedPhoneNumber);
        }
      } catch (error) {
        console.error('Error fetching phone number:', error);
        if (isMounted.current) {
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('phone_not_found', {
              defaultValue: 'Phone number not found. Please log in again.',
            })
          );
        }
      }
    };
    fetchPhoneNumber();
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!phoneNumber) return;

    setIsLoadingContracts(true);
    const profileDocRef = doc(db, 'customerProfiles', phoneNumber);

    const unsubscribe = onSnapshot(
      profileDocRef,
      async (profileSnap) => {
        if (!isMounted.current) return;

        if (!profileSnap.exists()) {
          setContracts([]);
          setIsLoadingContracts(false);
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('profile_not_found', { defaultValue: 'Customer profile not found.' })
          );
          return;
        }

        const profile = profileSnap.data() as CustomerProfile;
        const contractIds = profile.contracts || [];

        try {
          const contractPromises = contractIds.map(async (id) => {
            const ref = doc(db, 'contracts', id);
            const snap = await getDoc(ref);
            return snap.exists() ? (snap.data() as Contract) : null;
          });

          const results = await Promise.all(contractPromises);
          const valid = results.filter((c): c is Contract => c !== null);

          if (isMounted.current) {
            setContracts(valid);
            setIsLoadingContracts(false);
          }
        } catch (error) {
          console.error('Error fetching contracts:', error);
          if (isMounted.current) {
            Alert.alert(
              i18n.t('error', { defaultValue: 'Error' }),
              i18n.t('fetch_contracts_failed', {
                defaultValue: 'Failed to fetch contracts.',
              })
            );
            setIsLoadingContracts(false);
          }
        }
      },
      (error) => {
        console.error('Snapshot error:', error);
        if (isMounted.current) {
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('fetch_contracts_failed', {
              defaultValue: 'Failed to fetch contracts.',
            })
          );
          setIsLoadingContracts(false);
        }
      }
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [phoneNumber]);

  const renderContractCard = ({ item }: { item: Contract }) => (
    <View style={styles.contractCard}>
      <Text style={styles.contractText}>
        {i18n.t('job_finder', { defaultValue: 'Job Finder' })}: {item.jobFinderName}
      </Text>
      {item.status === 'accepted' && (
        <Text style={styles.contractSubText}>
          {i18n.t('job_finder_phone', { defaultValue: 'Job Finder Phone' })}:{' '}
          {item.jobFinderPhoneNumber}
        </Text>
      )}
      <Text style={styles.contractSubText}>
        {i18n.t('skill', { defaultValue: 'Skill' })}:{' '}
        {i18n.t(item.skill.toLowerCase().replace(' ', '_'), { defaultValue: item.skill })}
      </Text>
      <Text style={styles.contractSubText}>
        {i18n.t('status', { defaultValue: 'Status' })}:{' '}
        {i18n.t(`status_${item.status}`, { defaultValue: item.status })}
      </Text>
      <Text style={styles.contractSubText}>
        {i18n.t('created_at', { defaultValue: 'Created At' })}:{' '}
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>

      {/* ✅ APP BAR ADDED */}
      <AppBar title={i18n.t('current_contracts', { defaultValue: 'Current Contracts' })} />

      <View style={styles.container}>
        {isLoadingContracts ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : contracts.length > 0 ? (
          <FlatList
            data={contracts}
            renderItem={renderContractCard}
            keyExtractor={(item) =>
              `${item.customerPhoneNumber}_${item.jobFinderPhoneNumber}`
            }
            contentContainerStyle={styles.contractList}
          />
        ) : (
          <Text style={styles.noContracts}>
            {i18n.t('no_contracts_found', { defaultValue: 'No contracts found.' })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  contractList: { paddingBottom: 20 },
  contractCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 3,
  },
  contractText: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  contractSubText: { fontSize: 14, color: '#555', marginBottom: 3 },
  loader: { marginTop: 20 },
  noContracts: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 20 },
});
