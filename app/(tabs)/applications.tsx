import AppBar from "@/components/appbar";
import i18n from "@/constants/i18n";
import { db } from "@/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BannerAdCard from "@/components/banneradcard";
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  setDoc,
  collection,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

// --- INTERFACE DEFINITIONS (UPDATED FOR CLARITY/CONSISTENCY) ---
interface JobFinderProfile {
  name: string;
  age: number;
  skillset: string[] | null | undefined;
}

interface Applicant {
  phoneNumber: string;
  profile: JobFinderProfile | null;
  status: "pending" | "accepted";
}

interface Gig {
  id: string;
  jobDescription: string;
  // Reflecting the format stored in Firestore: ISO 8601 string
  dateStart?: string;
  dateEnd?: string;
  // The time is stored as an ISO 8601 string but displayed with time component
  time?: string;
  address?: string;
  applicants: Applicant[];
}
// --- END INTERFACE DEFINITIONS ---

const MyApplications: React.FC = () => {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // A ref to hold all unsubscribe functions for cleanup
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Helper function for date formatting
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "N/A";
    const locale = i18n.locale || "en-US";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original string if parsing failed
      }
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch (e) {
      console.error("Date formatting error:", e);
      return dateString;
    }
  };

  // Helper function to format time
  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return "N/A";
    const locale = i18n.locale || "en-US";
    try {
      const time = new Date(timeString);
      if (isNaN(time.getTime())) {
        return "N/A";
      }
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(time);
    } catch (e) {
      console.error("Time formatting error:", e);
      return "N/A";
    }
  };

  // Insert banner ads every 3 items + first position + fallback if empty
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
    result.push({ type: "gig", ...items[i] });
  }

  return result;
};
const gigsWithAds = insertAds(gigs);

  // Helper function to safely update the gigs state (add/update)
  const updateGigState = (newGig: Gig) => {
    setGigs(prevGigs => {
      const existingIndex = prevGigs.findIndex(g => g.id === newGig.id);
      const updatedGigs = [...prevGigs];

      if (existingIndex > -1) {
        updatedGigs[existingIndex] = newGig;
      } else {
        updatedGigs.push(newGig);
      }

      return updatedGigs.sort((a, b) =>
        a.jobDescription.localeCompare(b.jobDescription)
      );
    });
  };

  // --- MAIN LISTENER SETUP ---
  const setupRealtimeListeners = React.useCallback(async () => {
    setLoading(true);
    unsubscribeRefs.current.forEach(unsub => unsub());
    unsubscribeRefs.current = [];
    setGigs([]);

    const phoneNumber = await AsyncStorage.getItem("phoneNumber");
    if (!phoneNumber) {
      Alert.alert(
        i18n.t("error", { defaultValue: "Error" }),
        i18n.t("phone_not_found", {
          defaultValue: "Vendor phone number not found. Please log in again.",
        })
      );
      setLoading(false);
      return;
    }

    const vendorProfileRef = doc(db, "vendorProfiles", phoneNumber);

    const profileUnsubscribe = onSnapshot(
      vendorProfileRef,
      vendorProfileSnap => {
        // Clear old gig listeners & gigs state from the previous snapshot
        unsubscribeRefs.current
          .filter(unsub => unsub !== profileUnsubscribe)
          .forEach(unsub => unsub());
        unsubscribeRefs.current = [profileUnsubscribe];

        if (!vendorProfileSnap.exists()) {
          setGigs([]);
          setLoading(false);
          return;
        }

        const myGigs: string[] = vendorProfileSnap.data()?.myGigs || [];

        if (myGigs.length === 0) {
          setGigs([]);
          setLoading(false);
          return;
        }

        let gigsProcessed = 0;
        const totalGigs = myGigs.length;

        myGigs.forEach(gigId => {
          const gigRef = doc(db, "gigs", gigId);

          const gigUnsubscribe = onSnapshot(
            gigRef,
            async gigDoc => {
              if (!gigDoc.exists()) {
                setGigs(prevGigs => prevGigs.filter(g => g.id !== gigId));
                return;
              }

              const gigData = gigDoc.data();

              const pendingPhoneNumbers: string[] = gigData.applicants || [];
              const acceptedPhoneNumbers: string[] =
                gigData.acceptedApplicants || [];

              const allApplicantPhoneNumbers = [
                ...new Set([
                  ...pendingPhoneNumbers,
                  ...acceptedPhoneNumbers,
                ]),
              ];

              const applicantsWithProfiles: Applicant[] = [];
              for (const phone of allApplicantPhoneNumbers) {
                const profileRef = doc(db, "jobFinderProfiles", phone);
                const profileSnap = await getDoc(profileRef);
                const profileData = profileSnap.exists()
                  ? (profileSnap.data() as Omit<
                      JobFinderProfile,
                      "age"
                    > & { age: any; skillset: any[] })
                  : null;

                const isAccepted = acceptedPhoneNumbers.includes(phone);

                applicantsWithProfiles.push({
                  phoneNumber: phone,
                  profile: profileData
                    ? {
                        name: profileData.name || "N/A",
                        age: parseInt(String(profileData.age), 10) || 0,
                        skillset: Array.isArray(profileData.skillset)
                          ? profileData.skillset
                          : [],
                      }
                    : null,
                  status: isAccepted ? "accepted" : "pending",
                });
              }

              const updatedGig: Gig = {
                id: gigDoc.id,
                jobDescription: gigData.jobDescription || "N/A",
                dateStart: gigData.dateStart,
                time: gigData.time,
                address: gigData.address,
                applicants: applicantsWithProfiles.sort((a, b) => {
                  if (a.status === "accepted" && b.status === "pending")
                    return -1;
                  if (a.status === "pending" && b.status === "accepted")
                    return 1;
                  return 0;
                }),
              };

              updateGigState(updatedGig);

              if (gigsProcessed < totalGigs) {
                gigsProcessed++;
              }
              if (gigsProcessed === totalGigs) {
                setLoading(false);
              }
            },
            error => {
              console.error(`Error listening to gig ${gigId}:`, error);
            }
          );

          unsubscribeRefs.current.push(gigUnsubscribe);
        });

        if (myGigs.length === 0) {
          setLoading(false);
        }
      },
      error => {
        console.error("Real-time vendor profile listener error:", error);
        setLoading(false);
        Alert.alert(
          i18n.t("error", { defaultValue: "Error" }),
          i18n.t("fetch_failed", {
            defaultValue: "Failed to fetch your gig list.",
          })
        );
      }
    );

    const existingIndex =
      unsubscribeRefs.current.indexOf(profileUnsubscribe);
    if (existingIndex === -1) {
      unsubscribeRefs.current.push(profileUnsubscribe);
    }
  }, [i18n]);

  // --- HOOKS ---
  useEffect(() => {
    setupRealtimeListeners();

    return () => {
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, [setupRealtimeListeners]);

  // --- ACTIONS ---
  const handleAccept = async (gigId: string, applicantPhone: string) => {
    setIsProcessing(`${gigId}-${applicantPhone}`);

    try {
      const gigRef = doc(db, "gigs", gigId);

      // 1. Move the applicant from pending → accepted
      await updateDoc(gigRef, {
        applicants: arrayRemove(applicantPhone),
        acceptedApplicants: arrayUnion(applicantPhone),
      });

      // 2. Create a chat instance if it doesn't already exist
      // 2. Create a chat instance if it doesn't already exist
      const vendorPhone = await AsyncStorage.getItem("phoneNumber");
      if (!vendorPhone) {
        throw new Error("Vendor phone number missing");
      }

      // Generate deterministic Chat ID
      const chatId = `vf_${
        vendorPhone < applicantPhone
          ? vendorPhone + "_" + applicantPhone
          : applicantPhone + "_" + vendorPhone
      }`;

      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      // Create chat only if it does not exist
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          vendor: vendorPhone,
          finder: applicantPhone,
          allPhones: [vendorPhone, applicantPhone],  // ⭐ REQUIRED ⭐
          content: [],
          createdAt: Date.now(),
        });
      }
      
      Alert.alert(
        i18n.t("success", { defaultValue: "Success" }),
        i18n.t("applicant_accepted", {
          defaultValue: "Applicant accepted and chat created!",
        })
      );
    } catch (error: any) {
      console.error("Error accepting applicant:", error);
      Alert.alert(
        i18n.t("error", { defaultValue: "Error" }),
        i18n.t("action_failed", {
          defaultValue:
            "Failed to accept applicant or create chat. Please try again.",
        })
      );
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (gigId: string, applicantPhone: string) => {
    setIsProcessing(`${gigId}-${applicantPhone}`);
    try {
      const gigRef = doc(db, "gigs", gigId);
      await updateDoc(gigRef, {
        applicants: arrayRemove(applicantPhone),
        acceptedApplicants: arrayRemove(applicantPhone),
      });
      Alert.alert(
        i18n.t("success", { defaultValue: "Success" }),
        i18n.t("applicant_rejected", {
          defaultValue: "Applicant rejected successfully!",
        })
      );
    } catch (error: any) {
      console.error(
        "Error rejecting applicant:",
        error.message,
        error.code || "No code"
      );
      Alert.alert(
        i18n.t("error", { defaultValue: "Error" }),
        i18n.t("action_failed", {
          defaultValue: "Failed to reject applicant. Please try again.",
        })
      );
    } finally {
      setIsProcessing(null);
    }
  };

  // --- RENDER COMPONENTS ---
  const renderApplicant = ({
    item: applicant,
    gigId,
  }: {
    item: Applicant;
    gigId: string;
  }) => {
    const isAccepted = applicant.status === "accepted";
    const uniqueKey = `${gigId}-${applicant.phoneNumber}`;
    const isLoading = isProcessing === uniqueKey;

    return (
      <View style={styles.applicantItem} key={applicant.phoneNumber}>
        <Text style={styles.applicantName}>
          {applicant.profile?.name || applicant.phoneNumber}
        </Text>

        {isAccepted ? (
          <Text style={[styles.applicantDetail, styles.acceptedText]}>
            {i18n.t("phone_number", { defaultValue: "Phone" })}:{" "}
            {applicant.phoneNumber}
          </Text>
        ) : (
          <Text style={styles.applicantDetail}>
            {i18n.t("status", { defaultValue: "Status" })}:{" "}
            {i18n.t("pending", { defaultValue: "Pending" })}
          </Text>
        )}

        <Text style={styles.applicantDetail}>
          {i18n.t("age", { defaultValue: "Age" })}:{" "}
          {applicant.profile?.age || "N/A"}
        </Text>

        <Text style={styles.applicantDetail}>
          {i18n.t("skillset", { defaultValue: "Skillset" })}:{" "}
          {applicant.profile &&
          Array.isArray(applicant.profile.skillset) &&
          applicant.profile.skillset.length > 0
            ? applicant.profile.skillset.join(", ")
            : "N/A"}
        </Text>

        <View style={styles.buttonContainer}>
          {!isAccepted && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.acceptButton,
                  isLoading && { opacity: 0.5 },
                ]}
                onPress={() => handleAccept(gigId, applicant.phoneNumber)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {i18n.t("accept", { defaultValue: "Accept" })}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.rejectButton,
                  isLoading && { opacity: 0.5 },
                ]}
                onPress={() => handleReject(gigId, applicant.phoneNumber)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {i18n.t("reject", { defaultValue: "Reject" })}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderGig = ({ item: gig }: { item: Gig }) => (
  <View style={styles.gigCard}>
    <Text style={styles.gigTitle}>{gig.jobDescription}</Text>
    <Text style={styles.gigDetail}>
      {i18n.t("address", { defaultValue: "Address" })}: {gig.address || "N/A"}
    </Text>
    <Text style={styles.gigDetail}>
      {i18n.t("date", { defaultValue: "Date" })}: {formatDate(gig.dateStart)} @ {formatTime(gig.time)}
    </Text>

    {gig.applicants.length > 0 ? (
      <FlatList
        data={gig.applicants}
        keyExtractor={(a) => a.phoneNumber}
        renderItem={({ item }) =>
          renderApplicant({ item, gigId: gig.id })
        }
        scrollEnabled={false}
      />
    ) : (
      <Text style={styles.noApplicants}>
        {i18n.t("no_applicants", {
          defaultValue: "No applicants for this gig.",
        })}
      </Text>
    )}
  </View>
);


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <AppBar title={i18n.t("applications", { defaultValue: "Applications" })} />
          <View style={styles.container}>
      {gigs.length === 0 ? (
        <Text style={styles.noGigs}>
          {i18n.t("no_gigs", { defaultValue: "No gigs found." })}
        </Text>
      ) : (
        <FlatList
          data={gigsWithAds}
          keyExtractor={(item, index) => item.id + "-" + index}
          renderItem={({ item }) => {
            if (item.type === "ad") return <BannerAdCard />;
            return renderGig({ item });
          }}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create<{
  container: ViewStyle;
  loadingContainer: ViewStyle;
  title: TextStyle;
  listContainer: ViewStyle;
  gigCard: ViewStyle;
  gigTitle: TextStyle;
  gigDetail: TextStyle;
  noApplicants: TextStyle;
  noGigs: TextStyle;
  applicantItem: ViewStyle;
  applicantName: TextStyle;
  applicantDetail: TextStyle;
  applicantList: ViewStyle;
  buttonContainer: ViewStyle;
  actionButton: ViewStyle;
  acceptButton: ViewStyle;
  rejectButton: ViewStyle;
  buttonText: TextStyle;
  acceptedText: TextStyle;
}>({
  container: { flex: 1, padding: 16, backgroundColor: "#fff"},
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  listContainer: { paddingBottom: 30 },
  gigCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  gigTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  gigDetail: { fontSize: 14, color: "#666", marginBottom: 4 },
  noApplicants: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginVertical: 10,
  },
  noGigs: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 20,
  },
  applicantItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 10,
  },
  applicantName: { fontSize: 18, fontWeight: "bold" },
  applicantDetail: { fontSize: 14, color: "#555", marginVertical: 2 },
  applicantList: { paddingBottom: 10 },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
  },
  acceptButton: { backgroundColor: "#28a745" },
  rejectButton: { backgroundColor: "#dc3545" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  acceptedText: { color: "#28a745", fontWeight: "bold" },
});

export default MyApplications;
