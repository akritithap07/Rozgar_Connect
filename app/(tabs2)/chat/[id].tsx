import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppBar from "@/components/appbar";

interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

interface ChatDoc {
  id: string;
  jobFinder?: string;
  vendor?: string;
  customer?: string;
  content?: ChatMessage[];
}

export default function ChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
  const [phone, setPhone] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatDoc | null>(null);
  const [text, setText] = useState("");
  const flatlistRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    (async () => {
      const number = await AsyncStorage.getItem("phoneNumber");
      setPhone(number);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;

    const chatRef = doc(db, "chats", id);

    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        delete (data as any).id;

        setChat({
          ...data,
          id: snap.id,
        });

        setTimeout(() => {
          flatlistRef.current?.scrollToEnd({ animated: true });
        }, 50);
      }
    });

    return () => unsub();
  }, [id]);

  const sendMessage = async () => {
    if (!text.trim() || !phone) return;

    const message = text.trim();
    setText(""); // <-- clears instantly

    const chatRef = doc(db, "chats", id);

    const msg: ChatMessage = {
      sender: phone,
      message,
      timestamp: Date.now(),
    };

    // Firestore write happens AFTER clearing UI
    await updateDoc(chatRef, {
      content: arrayUnion(msg),
    });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isSelf = item.sender === phone;

    return (
      <View
        style={[
          styles.msgContainer,
          isSelf ? styles.selfMsg : styles.otherMsg,
        ]}
      >
        <Text style={styles.msgText}>{item.message}</Text>
      </View>
    );
  };

  if (!chat) {
    return (
      <View style={styles.loading}>
        <Text style={{ fontSize: 18 }}>Loading chat...</Text>
      </View>
    );
  }

return (
  <View style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1 }}>
        
        {/* App Bar */}
        <AppBar
          title={name || "Chat"}
          onBack={() => router.back()}
        />

        {/* Messages */}
        <FlatList
          ref={flatlistRef}
          data={chat.content || []}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 20,
          }}
        />
      </View>

      {/* Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Ionicons name="send" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>

    {/* Bottom spacer */}
    <View style={{ height: 90 }} />
  </View>
);
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  msgContainer: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 12,
    marginVertical: 6,
  },
  selfMsg: {
    backgroundColor: "#c9ffd4",
    alignSelf: "flex-end",
  },
  otherMsg: {
    backgroundColor: "#cfe2ff",
    alignSelf: "flex-start",
  },
  msgText: {
    fontSize: 15,
  },

  inputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },

  sendBtn: {
    backgroundColor: "#007bff",
    padding: 14,
    borderRadius: 30,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
