import AppBar from "@/components/appbar";
import { db } from "@/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  arrayUnion,
  collection,
  doc,
  runTransaction,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const THEME_OPTIONS = [
  "Education",
  "Health",
  "Environment",
  "Women Empowerment",
  "Youth Development",
  "Animal Welfare",
  "Disability Support",
  "Rural Development",
  "Other",
];

type ErrorState = {
  name?: string;
  regID?: string;
  contact?: string;
  theme?: string;
  startDate?: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  location?: string;
  pincode?: string;
  numVolunteers?: string;
};

export default function NgoEventUpload() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [regID, setRegID] = useState("");
  const [contact, setContact] = useState("");
  const [theme, setTheme] = useState("");

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [timeFrom, setTimeFrom] = useState(new Date());
  const [timeTo, setTimeTo] = useState(new Date());

  const [location, setLocation] = useState("");
  const [pincode, setPincode] = useState("");

  const [numVolunteers, setNumVolunteers] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [hasUserEditedLocation, setHasUserEditedLocation] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showFromTimePicker, setShowFromTimePicker] = useState(false);
  const [showToTimePicker, setShowToTimePicker] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<ErrorState>({});

  // Init: phone, contact, auto GPS -> address + pincode + lat/lon
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem("phoneNumber");
        if (!stored) return;

        setPhoneNumber(stored);
        setContact(stored);

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        let loc = await Location.getCurrentPositionAsync({});
        let geo = await Location.reverseGeocodeAsync(loc.coords);

        // direct GPS coords
        setLat(loc.coords.latitude);
        setLon(loc.coords.longitude);

        if (geo.length > 0) {
          const place = geo[0];
          setLocation(
            `${place.name || ""} ${place.street || ""} ${place.city || ""} ${
              place.region || ""
            }`.trim()
          );
          setPincode(place.postalCode || "");
        }
      } catch (err) {
        console.error("Auto-location error:", err);
      }
    };

    init();
  }, []);

  // Auto geocode when user edits location/pincode (debounced)
  useEffect(() => {
    if (!hasUserEditedLocation) return;

    if (!location.trim()) {
      setLat(null);
      setLon(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const encoded = encodeURIComponent(location + " " + pincode);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`,
          { headers: { "User-Agent": "RozgarConnectApp/1.0" } }
        );

        const data = await res.json();

        if (data.length > 0) {
          setLat(parseFloat(data[0].lat));
          setLon(parseFloat(data[0].lon));
          setErrors((prev) => ({ ...prev, location: undefined }));
        } else {
          setLat(null);
          setLon(null);
          setErrors((prev) => ({
            ...prev,
            location: "Could not find this address. Please adjust.",
          }));
        }
      } catch (err) {
        setLat(null);
        setLon(null);
        setErrors((prev) => ({
          ...prev,
          location: "Unable to verify this address. Please adjust.",
        }));
      }
      setGeoLoading(false);
    }, 800);

    return () => clearTimeout(timeout);
  }, [location, pincode, hasUserEditedLocation]);

  // Validation logic
  const validateForm = (): boolean => {
    const newErrors: ErrorState = {};

    if (!name.trim()) newErrors.name = "Event name is required.";
    if (!regID.trim()) newErrors.regID = "Registration ID is required.";
    if (!contact.trim()) newErrors.contact = "Contact number is required.";
    if (!theme.trim()) newErrors.theme = "Please select an event theme.";

    if (!location.trim()) {
      newErrors.location = "Location is required.";
    }

    if (!numVolunteers.trim()) {
      newErrors.numVolunteers = "Number of volunteers is required.";
    } else if (isNaN(parseInt(numVolunteers, 10))) {
      newErrors.numVolunteers = "Please enter a valid number.";
    } else if (parseInt(numVolunteers, 10) <= 0) {
      newErrors.numVolunteers = "Volunteers must be greater than 0.";
    }

    if (endDate < startDate) {
      newErrors.endDate = "End date cannot be before start date.";
    }

    if (pincode && !/^\d{6}$/.test(pincode)) {
      newErrors.pincode = "Pincode must be a 6-digit number.";
    }

    if (lat === null || lon === null) {
      newErrors.location =
        newErrors.location ||
        "Could not determine coordinates. Please refine address/pincode.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    const ok = validateForm();
    if (!ok) {
      alert("Please fix the highlighted errors.");
      return;
    }

    setIsSubmitting(true);
    try {
      const storedPhone = await AsyncStorage.getItem("phoneNumber");
      if (!storedPhone) {
        alert("Phone number not found. Please log in again.");
        setIsSubmitting(false);
        return;
      }

      const eventData = {
        type: "ngo_event",
        ngoPhoneNumber: storedPhone,
        imageUri: imageUri ?? "",
        name,
        regID,
        contact: storedPhone,
        theme,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timeFrom: timeFrom.toISOString(),
        timeTo: timeTo.toISOString(),
        location,
        pincode,
        numVolunteers: parseInt(numVolunteers, 10),
        additionalInfo,
        lat,
        lon,
        applicants: [],
        acceptedApplicants: [],
        createdAt: new Date().toISOString(),
      };

      await runTransaction(db, async (transaction) => {
        const eventsCollection = collection(db, "events");
        const eventRef = doc(eventsCollection);

        transaction.set(eventRef, eventData);

        const ngoRef = doc(db, "ngoProfiles", storedPhone);

        transaction.set(
          ngoRef,
          { myEvents: arrayUnion(eventRef.id) },
          { merge: true }
        );
      });

      setModalVisible(true);
    } catch (err) {
      console.log(err);
      alert("Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <AppBar title="Post Event" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* IMAGE PICKER */}
        <Text style={styles.label}>Image (Optional)</Text>
        <View style={styles.imagePickerContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text style={styles.noImageText}>No image selected</Text>
          )}

          <View style={styles.imageButtonContainer}>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Text style={styles.imageButtonText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
              <Text style={styles.imageButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Event Name */}
        <Text style={styles.label}>Event Name</Text>
        <TextInput
          style={[
            styles.textInput,
            errors.name && styles.errorInput,
          ]}
          value={name}
          onChangeText={(val) => {
            setName(val);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        {/* Registration ID */}
        <Text style={styles.label}>Registration ID</Text>
        <TextInput
          style={[
            styles.textInput,
            errors.regID && styles.errorInput,
          ]}
          value={regID}
          onChangeText={(val) => {
            setRegID(val);
            setErrors((prev) => ({ ...prev, regID: undefined }));
          }}
        />
        {errors.regID && <Text style={styles.errorText}>{errors.regID}</Text>}

        {/* Contact Number (read-only) */}
        <Text style={styles.label}>Contact Number</Text>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: "#eee" },
            errors.contact && styles.errorInput,
          ]}
          value={contact}
          editable={false}
        />
        {errors.contact && (
          <Text style={styles.errorText}>{errors.contact}</Text>
        )}

        {/* Event Theme */}
        <Text style={styles.label}>Event Theme</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton,
            errors.theme && styles.errorInput,
          ]}
          onPress={() => setShowThemeModal(true)}
        >
          <Text>{theme || "Select Theme"}</Text>
        </TouchableOpacity>
        {errors.theme && <Text style={styles.errorText}>{errors.theme}</Text>}

        {/* Start Date */}
        <Text style={styles.label}>Start Date</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton,
            errors.startDate && styles.errorInput,
          ]}
          onPress={() => setShowStartPicker(true)}
        >
          <Text>{startDate.toDateString()}</Text>
        </TouchableOpacity>
        {errors.startDate && (
          <Text style={styles.errorText}>{errors.startDate}</Text>
        )}

        {/* End Date */}
        <Text style={styles.label}>End Date</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton,
            errors.endDate && styles.errorInput,
          ]}
          onPress={() => setShowEndPicker(true)}
        >
          <Text>{endDate.toDateString()}</Text>
        </TouchableOpacity>
        {errors.endDate && (
          <Text style={styles.errorText}>{errors.endDate}</Text>
        )}

        {/* Time From */}
        <Text style={styles.label}>Time From</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton,
            errors.timeFrom && styles.errorInput,
          ]}
          onPress={() => setShowFromTimePicker(true)}
        >
          <Text>
            {timeFrom.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </TouchableOpacity>
        {errors.timeFrom && (
          <Text style={styles.errorText}>{errors.timeFrom}</Text>
        )}

        {/* Time To */}
        <Text style={styles.label}>Time To</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton,
            errors.timeTo && styles.errorInput,
          ]}
          onPress={() => setShowToTimePicker(true)}
        >
          <Text>
            {timeTo.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </TouchableOpacity>
        {errors.timeTo && (
          <Text style={styles.errorText}>{errors.timeTo}</Text>
        )}

        {/* Location */}
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={[
            styles.textInput,
            { height: 70 },
            errors.location && styles.errorInput,
          ]}
          multiline
          value={location}
          onChangeText={(text) => {
            setLocation(text);
            setHasUserEditedLocation(true);
            setLat(null);
            setLon(null);
            setErrors((prev) => ({ ...prev, location: undefined }));
          }}
        />
        {geoLoading && (
          <Text style={{ fontSize: 12, color: "#777", marginTop: -5 }}>
            Finding location coordinates...
          </Text>
        )}
        {errors.location && (
          <Text style={styles.errorText}>{errors.location}</Text>
        )}

        {/* Pincode */}
        <Text style={styles.label}>Pincode (Optional)</Text>
        <TextInput
          style={[
            styles.textInput,
            errors.pincode && styles.errorInput,
          ]}
          keyboardType="numeric"
          maxLength={6}
          value={pincode}
          onChangeText={(text) => {
            setPincode(text);
            setHasUserEditedLocation(true);
            setLat(null);
            setLon(null);
            setErrors((prev) => ({ ...prev, pincode: undefined }));
          }}
        />
        {errors.pincode && (
          <Text style={styles.errorText}>{errors.pincode}</Text>
        )}

        {/* Volunteers Required */}
        <Text style={styles.label}>Volunteers Required</Text>
        <TextInput
          style={[
            styles.textInput,
            errors.numVolunteers && styles.errorInput,
          ]}
          keyboardType="number-pad"
          value={numVolunteers}
          onChangeText={(val) => {
            setNumVolunteers(val);
            setErrors((prev) => ({ ...prev, numVolunteers: undefined }));
          }}
        />
        {errors.numVolunteers && (
          <Text style={styles.errorText}>{errors.numVolunteers}</Text>
        )}

        {/* Additional Info */}
        <Text style={styles.label}>Additional Info</Text>
        <TextInput
          style={[styles.textInput, { height: 70 }]}
          multiline
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>Event posted successfully!</Text>
            <TouchableOpacity onPress={closeModal} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* THEME PICKER MODAL */}
      <Modal visible={showThemeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>Select Theme</Text>

            {THEME_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                style={{ paddingVertical: 10 }}
                onPress={() => {
                  setTheme(item);
                  setErrors((prev) => ({ ...prev, theme: undefined }));
                  setShowThemeModal(false);
                }}
              >
                <Text style={{ fontSize: 18 }}>{item}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setShowThemeModal(false)}>
              <Text style={[styles.modalButtonText, { marginTop: 10 }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DATE / TIME PICKERS */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(e, date) => {
            setShowStartPicker(false);
            if (date) {
              setStartDate(date);
              setErrors((prev) => ({
                ...prev,
                startDate: undefined,
                endDate: undefined,
              }));
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(e, date) => {
            setShowEndPicker(false);
            if (date) {
              setEndDate(date);
              setErrors((prev) => ({ ...prev, endDate: undefined }));
            }
          }}
        />
      )}

      {showFromTimePicker && (
        <DateTimePicker
          value={timeFrom}
          mode="time"
          display="default"
          onChange={(e, time) => {
            setShowFromTimePicker(false);
            if (time) {
              setTimeFrom(time);
              setErrors((prev) => ({ ...prev, timeFrom: undefined }));
            }
          }}
        />
      )}

      {showToTimePicker && (
        <DateTimePicker
          value={timeTo}
          mode="time"
          display="default"
          onChange={(e, time) => {
            setShowToTimePicker(false);
            if (time) {
              setTimeTo(time);
              setErrors((prev) => ({ ...prev, timeTo: undefined }));
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 100 },
  label: { fontSize: 18, fontWeight: "bold", marginBottom: 5, marginTop: 12 },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorInput: {
    borderColor: "#e53935",
    borderWidth: 2,
  },
  errorText: {
    color: "#e53935",
    fontSize: 12,
    marginBottom: 4,
  },
  submitButton: {
    backgroundColor: "#007bff",
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: 280,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  modalText: { fontSize: 20, textAlign: "center", marginBottom: 15 },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  imagePickerContainer: { alignItems: "center", marginBottom: 20 },
  imagePreview: { width: 200, height: 150, borderRadius: 12, marginBottom: 10 },
  noImageText: { color: "#666", marginBottom: 10 },
  imageButtonContainer: { flexDirection: "row", gap: 10 },
  imageButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 10,
  },
  imageButtonText: { color: "#fff", fontWeight: "bold" },
});
