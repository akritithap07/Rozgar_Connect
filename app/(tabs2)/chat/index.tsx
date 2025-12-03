import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { useRouter } from "expo-router";
import AppBar from "@/components/appbar";

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface Chat {
  id: string;
  allPhones?: string[];
  jobFinder?: string;
  vendor?: string;
  customer?: string;
  finder?: string;
  content?: ChatMessage[];
}

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    let unsub: (() => void) | undefined;

    const load = async () => {
      const number = await AsyncStorage.getItem("phoneNumber");
      setPhone(number);

      if (!number) {
        setLoading(false);
        return;
      }

      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("allPhones", "array-contains", number));

      unsub = onSnapshot(q, async (snapshot) => {
        const data: Chat[] = snapshot.docs.map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            ...raw,
          };
        });

        setChats(data);
        setLoading(false);

        // After we have chats, prefetch names for all "other" phones
        const allOtherPhones = new Set<string>();

        data.forEach((chat) => {
          const other = getOtherPerson(chat, number);
          if (other && other !== "Unknown") {
            allOtherPhones.add(other);
          }
        });

        // Filter phones we don't already have in nameMap
        const phonesToFetch = Array.from(allOtherPhones).filter(
          (p) => !nameMap[p]
        );

        if (phonesToFetch.length === 0) return;

        const newNames: Record<string, string> = {};

        await Promise.all(
          phonesToFetch.map(async (p) => {
            const name = await fetchNameForPhone(p);
            newNames[p] = name;
          })
        );
        setNameMap((prev) => ({ ...prev, ...newNames }));
      });
    };

    load();

    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const fetchNameForPhone = async (phone: string): Promise<string> => {
  try {
    const userRef = doc(db, "users", phone);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return phone;

    const data = userSnap.data() as any;
    const rawRole = data.role;
    if (!rawRole) return phone;

    const roleKey = String(rawRole).toLowerCase();

    const roleToCollection: Record<string, string> = {
      jobfinder: "jobFinderProfiles",   // your case
      vendor: "vendorProfiles",
      customer: "customerProfiles",
      // add other roles here if needed
    };

    const collectionName = roleToCollection[roleKey];
    if (!collectionName) return phone;

    const profRef = doc(db, collectionName, phone);
    const profSnap = await getDoc(profRef);
    if (!profSnap.exists()) return phone;

    const profile = profSnap.data() as any;
    return profile.name || phone;
  } catch (err) {
    return phone;
  }
};


  const getOtherPerson = (chat: Chat, self: string) => {
    if (Array.isArray(chat.allPhones) && chat.allPhones.length > 0) {
      const other =
        chat.allPhones.find((p) => p !== self) ?? chat.allPhones[0];
      return other || "Unknown";
    }

    const candidates = [
      chat.jobFinder,
      chat.vendor,
      chat.customer,
      (chat as any).finder,
    ].filter(Boolean) as string[];

    if (candidates.length === 0) return "Unknown";

    const other = candidates.find((p) => p !== self) ?? candidates[0];
    return other || "Unknown";
  };

  const getDisplayName = (chat: Chat): string => {
    if (!phone) return "Chat";
    const otherPhone = getOtherPerson(chat, phone);
    if (!otherPhone || otherPhone === "Unknown") return "Chat";
    return nameMap[otherPhone] || otherPhone;
  };

  const renderChat = ({ item }: { item: Chat }) => {
    const displayName = getDisplayName(item);

    const last =
      item.content && item.content.length
        ? item.content[item.content.length - 1].message
        : "No messages yet";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/chat/[id]",
            params: { id: item.id, name: displayName },
          })
        }
      >
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.lastMsg}>{last}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBar title="Chats" />

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChat}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No chats found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },

  list: {
    padding: 16,
    paddingTop: 8,
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },

  title: { fontSize: 18, fontWeight: "bold" },
  lastMsg: { marginTop: 6, color: "#666" },
  empty: { textAlign: "center", marginTop: 50, color: "#666" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
