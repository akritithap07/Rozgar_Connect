import i18n from '@/constants/i18n';
import { Text, View, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { doc, getDocs, query, collection, where, updateDoc, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/firebase';
import { setDoc, getDoc } from "firebase/firestore";
import AppBar from '@/components/appbar';

interface Contract {
  id: string; // Added id to the Contract interface
  customerPhoneNumber: string;
  jobFinderPhoneNumber: string;
  jobFinderName: string;
  customerAddress: string;
  skill: string;
  status: 'accepted' | 'rejected' | 'pending';
  createdAt: string;
}

export default function JobFinderContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const isMounted = useRef(true);

useEffect(() => {
  return () => {
    isMounted.current = false;
  };
}, []);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

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

  useEffect(() => {
    if (!phoneNumber) return;

    setIsLoadingContracts(true);
    const contractsQuery = query(
      collection(db, 'contracts'),
      where('jobFinderPhoneNumber', '==', phoneNumber)
    );

    const unsubscribe = onSnapshot(
      contractsQuery,
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        if (!isMounted.current) return;

        try {
          const contractsList: Contract[] = [];
          querySnapshot.forEach((doc: DocumentData) => {
            contractsList.push({ id: doc.id, ...doc.data() } as Contract);
          });

          if (isMounted.current) {
            setContracts(contractsList);
            setIsLoadingContracts(false);
          }
        } catch (error) {
          console.error('Error fetching contracts:', error);
          if (isMounted.current) {
            Alert.alert(
              i18n.t('error', { defaultValue: 'Error' }),
              i18n.t('fetch_contracts_failed', {
                defaultValue: 'Failed to fetch contracts. Please try again.',
              })
            );
            setIsLoadingContracts(false);
          }
        }
      },
      (error: Error) => {
        console.error('Error in contracts listener:', error);
        if (isMounted.current) {
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('fetch_contracts_failed', {
              defaultValue: 'Failed to fetch contracts. Please try again.',
            })
          );
          setIsLoadingContracts(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [phoneNumber]);

  const handleContractAction = async (
  contractId: string,
  action: "accepted" | "rejected"
) => {
  if (!isMounted.current) return;

  try {
    setIsLoadingContracts(true);

    const contractDocRef = doc(db, "contracts", contractId);
    await updateDoc(contractDocRef, { status: action });

    // --- AUTO-CREATE CHAT WHEN ACCEPTED ---
    if (action === "accepted") {
      const contractSnap = await getDoc(contractDocRef);
      if (contractSnap.exists()) {
        const data = contractSnap.data();

        const jobFinder = data.jobFinderPhoneNumber;
        const customer = data.customerPhoneNumber;

        // Deterministic chat ID (same order every time)
        const chatId = `cf_${jobFinder < customer ? jobFinder + '_' + customer : customer + '_' + jobFinder}`;

        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          jobFinder,
          customer,
          allPhones: [jobFinder, customer],       // REQUIRED FOR CHAT LIST
          content: [],
          createdAt: Date.now(),
        });
        }
      }
    }

    Alert.alert(
      i18n.t("success", { defaultValue: "Success" }),
      i18n.t(`contract_${action}`, {
        defaultValue: `Contract ${action} successfully!`,
      })
    );
  } catch (error) {
    console.error(`Error updating contract to ${action}:`, error);
    if (isMounted.current) {
      Alert.alert(
        i18n.t("error", { defaultValue: "Error" }),
        i18n.t("contract_update_failed", {
          defaultValue: "Failed to update contract status. Please try again.",
        })
      );
    }
  } finally {
    if (isMounted.current) {
      setIsLoadingContracts(false);
    }
  }
};


  const renderContractCard = ({ item }: { item: Contract }) => (
    <View style={styles.contractCard}>
      <Text style={styles.contractText}>
        {i18n.t('customer', { defaultValue: 'Customer' })}: {item.customerPhoneNumber}
      </Text>
      <Text style={styles.contractSubText}>
        {i18n.t('skill', { defaultValue: 'Skill' })}: {i18n.t(item.skill.toLowerCase().replace(' ', '_'), { defaultValue: item.skill })}
      </Text>
      <Text style={styles.contractSubText}>
        {i18n.t('status', { defaultValue: 'Status' })}: {i18n.t(`status_${item.status}`, { defaultValue: item.status })}
      </Text>
      <Text style={styles.contractSubText}>
        {i18n.t('created_at', { defaultValue: 'Created At' })}: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      {item.status === 'pending' && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleContractAction(item.id, 'accepted')}
            disabled={isLoadingContracts}
          >
            <Text style={styles.buttonText}>{i18n.t('accept', { defaultValue: 'Accept' })}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleContractAction(item.id, 'rejected')}
            disabled={isLoadingContracts}
          >
            <Text style={styles.buttonText}>{i18n.t('reject', { defaultValue: 'Reject' })}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>
    
    <AppBar title={i18n.t("job_finder_contracts", { defaultValue: "My Contracts" })} />

    <View style={styles.container}>
      {isLoadingContracts ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : contracts.length > 0 ? (
        <FlatList
          data={contracts}
          renderItem={renderContractCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.contractList}
        />
      ) : (
        <Text style={styles.noContracts}>
          {i18n.t("no_contracts_found", { defaultValue: "No contracts found." })}
        </Text>
      )}
    </View>

  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  contractList: { paddingBottom: 20 },
  contractCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  contractText: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  contractSubText: { fontSize: 14, color: '#555', marginBottom: 3 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  acceptButton: { backgroundColor: '#28a745' },
  rejectButton: { backgroundColor: '#dc3545' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  loader: { marginTop: 20 },
  noContracts: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 20 },
});