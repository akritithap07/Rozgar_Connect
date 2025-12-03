import AppBar from "@/components/appbar";
import i18n from "@/constants/i18n";
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
  ImageStyle,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

const JOB_DESCRIPTIONS = [
  "Lighting Repair",
  "Farming",
  "Plumbing",
  "Caretaking",
  "Tuition",
  "Driving",
  "Cooking",
  "Sewing",
  "Car Wash",
  "Construction",
  "Cleaning",
  "Animal Care",
  "Shop Keeping",
  "Tailoring",
  "Painting",
  "Mechanic",
  "Gardening",
  "Electrical",
  "Masonry",
  "Carpentry",
  "House Work",
].sort((a, b) => a.localeCompare(b));

type FieldErrorKeys =
  | "jobDescription"
  | "dateStart"
  | "dateEnd"
  | "time"
  | "numPeople"
  | "address"
  | "pincode"
  | "locationCoords";

export default function GigUpload() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [dateStart, setDateStart] = useState(new Date());
  const [dateEnd, setDateEnd] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [numPeople, setNumPeople] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [hasUserEditedLocation, setHasUserEditedLocation] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldErrorKeys, string>>>(
    {}
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert(
        i18n.t("permission_denied", {
          defaultValue: "Permission to access media library was denied",
        })
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alert(
        i18n.t("permission_denied", {
          defaultValue: "Permission to access camera was denied",
        })
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<FieldErrorKeys, string>> = {};

    if (!jobDescription.trim()) {
      newErrors.jobDescription = i18n.t("job_required", {
        defaultValue: "Please select a job description.",
      });
    }

    if (!numPeople.trim()) {
      newErrors.numPeople = i18n.t("people_required", {
        defaultValue: "Please enter number of people required.",
      });
    } else if (!/^\d+$/.test(numPeople.trim())) {
      newErrors.numPeople = i18n.t("invalid_number", {
        defaultValue: "Number of People must be a valid number.",
      });
    }

    if (!address.trim()) {
      newErrors.address = i18n.t("location_required", {
        defaultValue: "Please enter the location address.",
      });
    }

    if (!pincode.trim()) {
      newErrors.pincode = i18n.t("pincode_required", {
        defaultValue: "Please enter pincode.",
      });
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      newErrors.pincode = i18n.t("invalid_pincode", {
        defaultValue: "Pincode must be a valid 6-digit number.",
      });
    }

    // Date validation
    if (dateEnd < dateStart) {
      newErrors.dateEnd = i18n.t("invalid_date_range", {
        defaultValue: "End date cannot be before start date.",
      });
    }

    // Coordinates validation
    if (lat === null || lon === null) {
      newErrors.locationCoords = i18n.t("geocoding_failed", {
        defaultValue:
          "Unable to determine coordinates for this address. Please refine the location.",
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    setSubmitAttempted(true);

    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const phoneNumber = await AsyncStorage.getItem("phoneNumber");
      if (!phoneNumber) {
        alert(
          i18n.t("phone_not_found", {
            defaultValue: "Vendor phone number not found. Please log in again.",
          })
        );
        return;
      }

      const gigData = {
        vendorPhoneNumber: phoneNumber,
        imageUri: imageUri || "",
        jobDescription,
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString(),
        time: time.toISOString(),
        numPeople: parseInt(numPeople, 10),
        additionalInfo,
        address,
        pincode,
        lat,
        lon,
        applicants: [],
        acceptedApplicants: [],
        createdAt: new Date().toISOString(),
      };

      console.log("Submitting gig data:", gigData);

      await runTransaction(db, async (transaction) => {
        const gigsCollection = collection(db, "gigs");
        const gigRef = doc(gigsCollection);

        const vendorProfileRef = doc(db, "vendorProfiles", phoneNumber);
        const vendorProfileSnap = await transaction.get(vendorProfileRef);

        transaction.set(gigRef, gigData);

        if (!vendorProfileSnap.exists()) {
          transaction.set(vendorProfileRef, {
            myGigs: [gigRef.id],
          });
        } else {
          transaction.update(vendorProfileRef, {
            myGigs: arrayUnion(gigRef.id),
          });
        }

        console.log("Gig ID added to vendor profile myGigs:", gigRef.id);
      });

      console.log("Gig saved to Firestore");
      setModalVisible(true);
    } catch (error: any) {
      console.error(
        "Error saving gig to Firestore:",
        error.message,
        error.code || "No code"
      );
      alert(
        i18n.t("save_failed", {
          defaultValue: "Failed to upload gig. Please try again.",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setImageUri(null);
    setJobDescription("");
    setDateStart(new Date());
    setDateEnd(new Date());
    setTime(new Date());
    setNumPeople("");
    setAdditionalInfo("");
    setAddress("");
    setPincode("");
    setLat(null);
    setLon(null);
    setHasUserEditedLocation(false);
    setErrors({});
    setSubmitAttempted(false);
  };

  // Auto fetch GPS location once (Method A)
  useEffect(() => {
    const autoFetchLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        let location = await Location.getCurrentPositionAsync({});
        let geocode = await Location.reverseGeocodeAsync(location.coords);

        // Use GPS coords directly
        setLat(location.coords.latitude);
        setLon(location.coords.longitude);

        if (geocode.length > 0) {
          const place = geocode[0];
          setAddress(
            `${place.name || ""} ${place.street || ""} ${place.city || ""} ${
              place.region || ""
            }`.trim()
          );
          setPincode(place.postalCode || "");
        }
      } catch (e) {
        console.log("Auto-location failed", e);
      }
    };

    autoFetchLocation();
  }, []);

  // If user edits address or pincode, geocode via Nominatim (debounced)
  useEffect(() => {
    if (!hasUserEditedLocation) return;

    if (!address.trim()) {
      setLat(null);
      setLon(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const encodedAddress = encodeURIComponent(address + " " + pincode);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "RozgarConnectApp/1.0",
          },
        });

        if (!response.ok) {
          console.error("Geocoding response status:", response.status);
          setLat(null);
          setLon(null);
        } else {
          const data = await response.json();
          if (data.length > 0) {
            const newLat = parseFloat(data[0].lat);
            const newLon = parseFloat(data[0].lon);
            setLat(newLat);
            setLon(newLon);
            console.log("Geocoding successful: lat", newLat, "lon", newLon);
          } else {
            console.warn("No geocoding results for address:", address);
            setLat(null);
            setLon(null);
          }
        }
      } catch (error) {
        console.error("Error during geocoding:", error);
        setLat(null);
        setLon(null);
      }
      setGeoLoading(false);
    }, 800);

    return () => clearTimeout(timeout);
  }, [address, pincode, hasUserEditedLocation]);

  const hasError = (key: FieldErrorKeys) =>
    submitAttempted && !!errors[key];

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* App Bar */}
      <AppBar
        title={i18n.t("upload_gig", { defaultValue: "Upload Your Gig" })}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* IMAGE */}
        <Text style={styles.label}>
          {i18n.t("image", { defaultValue: "Image" })}:
        </Text>
        <View style={styles.imagePickerContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text style={styles.noImageText}>
              {i18n.t("no_image_selected", {
                defaultValue: "No image selected",
              })}
            </Text>
          )}

          <View style={styles.imageButtonContainer}>
            <TouchableOpacity
              style={[
                styles.imageButton,
                isSubmitting && styles.imageButtonDisabled,
              ]}
              onPress={pickImage}
              disabled={isSubmitting}
            >
              <Text style={styles.imageButtonText}>
                {i18n.t("pick_image", { defaultValue: "Pick from Gallery" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imageButton,
                isSubmitting && styles.imageButtonDisabled,
              ]}
              onPress={takePhoto}
              disabled={isSubmitting}
            >
              <Text style={styles.imageButtonText}>
                {i18n.t("take_photo", { defaultValue: "Take Photo" })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* JOB DESCRIPTION */}
        <Text style={styles.label}>
          {i18n.t("job_description", {
            defaultValue: "Job Description",
          })}
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("jobDescription") && styles.errorBorder,
          ]}
        >
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setDropdownVisible(true)}
            disabled={isSubmitting}
          >
            <Text style={styles.dropdownButtonText}>
              {jobDescription ||
                i18n.t("select_job", { defaultValue: "Select a job" })}
            </Text>
          </TouchableOpacity>
        </View>
        {hasError("jobDescription") && (
          <Text style={styles.errorText}>{errors.jobDescription}</Text>
        )}

        {/* Dropdown Modal */}
        <Modal visible={dropdownVisible} transparent animationType="fade">
          <View style={styles.dropdownOverlay}>
            <View style={styles.dropdownContainer}>
              <ScrollView>
                {JOB_DESCRIPTIONS.map((job) => (
                  <TouchableOpacity
                    key={job}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setJobDescription(job);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{job}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setDropdownVisible(false)}
                style={styles.dropdownCancel}
              >
                <Text style={styles.dropdownCancelText}>
                  {i18n.t("cancel", { defaultValue: "Cancel" })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* DATE START */}
        <Text style={styles.label}>
          {i18n.t("date_start", { defaultValue: "Date Start" })}:
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("dateStart") && styles.errorBorder,
          ]}
        >
          <TouchableOpacity
            onPress={() => !isSubmitting && setShowStartPicker(true)}
            style={styles.datePickerButton}
          >
            <Text>{dateStart.toDateString()}</Text>
          </TouchableOpacity>
        </View>
        {hasError("dateStart") && (
          <Text style={styles.errorText}>{errors.dateStart}</Text>
        )}

        {showStartPicker && (
          <DateTimePicker
            value={dateStart}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowStartPicker(Platform.OS === "ios");
              if (selected) setDateStart(selected);
            }}
          />
        )}

        {/* DATE END */}
        <Text style={styles.label}>
          {i18n.t("date_end", { defaultValue: "Date End" })}:
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("dateEnd") && styles.errorBorder,
          ]}
        >
          <TouchableOpacity
            onPress={() => !isSubmitting && setShowEndPicker(true)}
            style={styles.datePickerButton}
          >
            <Text>{dateEnd.toDateString()}</Text>
          </TouchableOpacity>
        </View>
        {hasError("dateEnd") && (
          <Text style={styles.errorText}>{errors.dateEnd}</Text>
        )}

        {showEndPicker && (
          <DateTimePicker
            value={dateEnd}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowEndPicker(Platform.OS === "ios");
              if (selected) setDateEnd(selected);
            }}
          />
        )}

        {/* TIME */}
        <Text style={styles.label}>
          {i18n.t("time", { defaultValue: "Time" })}:
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("time") && styles.errorBorder,
          ]}
        >
          <TouchableOpacity
            onPress={() => !isSubmitting && setShowTimePicker(true)}
            style={styles.datePickerButton}
          >
            <Text>
              {time.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>
        </View>
        {hasError("time") && (
          <Text style={styles.errorText}>{errors.time}</Text>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(_, selected) => {
              setShowTimePicker(Platform.OS === "ios");
              if (selected) setTime(selected);
            }}
          />
        )}

        {/* NUM PEOPLE */}
        <Text style={styles.label}>
          {i18n.t("num_people_required", {
            defaultValue: "Number of People Required",
          })}
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("numPeople") && styles.errorBorder,
          ]}
        >
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={numPeople}
            onChangeText={(text) => {
              setNumPeople(text);
              if (submitAttempted) {
                // live revalidate field
                setErrors((prev) => ({ ...prev, numPeople: undefined }));
              }
            }}
            placeholder={i18n.t("enter_number", {
              defaultValue: "Enter number",
            })}
            editable={!isSubmitting}
          />
        </View>
        {hasError("numPeople") && (
          <Text style={styles.errorText}>{errors.numPeople}</Text>
        )}

        {/* ADDITIONAL INFO */}
            <Text style={styles.label}>
      {i18n.t("additional_info", {
        defaultValue: "Additional Information",
      })}
    </Text>
    <View style={styles.fieldWrapper}>
      <TextInput
        style={[styles.textInput, { height: 80 }]}
        multiline
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
        placeholder={i18n.t("additional_info_placeholder", {
          defaultValue: "Anything else you want to add",
        })}
        editable={!isSubmitting}
      />
</View>



        {/* ADDRESS */}
        <Text style={styles.label}>
          {i18n.t("location", { defaultValue: "Location (Address)" })}
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            (hasError("address") || hasError("locationCoords")) &&
              styles.errorBorder,
          ]}
        >
          <TextInput
            style={[styles.textInput, { height: 80 }]}
            multiline
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setHasUserEditedLocation(true);
              setLat(null);
              setLon(null);
            }}
            placeholder={i18n.t("enter_location", {
              defaultValue: "Enter location",
            })}
            editable={!isSubmitting}
          />
        </View>
        {hasError("address") && (
          <Text style={styles.errorText}>{errors.address}</Text>
        )}
        {hasError("locationCoords") && (
          <Text style={styles.errorText}>{errors.locationCoords}</Text>
        )}

        {/* PINCODE */}
        <Text style={styles.label}>
          {i18n.t("pincode", { defaultValue: "Pincode" })}
        </Text>
        <View
          style={[
            styles.fieldWrapper,
            hasError("pincode") && styles.errorBorder,
          ]}
        >
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={pincode}
            onChangeText={(text) => {
              setPincode(text);
              setHasUserEditedLocation(true);
              setLat(null);
              setLon(null);
            }}
            placeholder={i18n.t("enter_pincode", {
              defaultValue: "Enter pincode",
            })}
            maxLength={6}
            editable={!isSubmitting}
          />
        </View>
        {hasError("pincode") && (
          <Text style={styles.errorText}>{errors.pincode}</Text>
        )}

        {geoLoading && (
          <Text style={styles.geoHintText}>
            Finding location coordinates...
          </Text>
        )}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isSubmitting || geoLoading) && { opacity: 0.5 },
          ]}
          onPress={onSubmit}
          disabled={isSubmitting || geoLoading}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {i18n.t("submit_gig", { defaultValue: "Submit Gig" })}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>
              {i18n.t("gig_uploaded", {
                defaultValue: "Gig uploaded successfully!",
              })}
            </Text>
            <TouchableOpacity onPress={closeModal} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>
                {i18n.t("ok", { defaultValue: "OK" })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<{
  safeContainer: ViewStyle;
  container: ViewStyle;
  contentContainer: ViewStyle;
  title: TextStyle;
  label: TextStyle;
  jobDescList: ViewStyle;
  jobItem: ViewStyle;
  jobItemSelected: ViewStyle;
  jobItemDisabled: ViewStyle;
  jobItemText: TextStyle;
  jobItemTextSelected: TextStyle;
  datePickerButton: ViewStyle;
  textInput: TextStyle;
  submitButton: ViewStyle;
  submitButtonDisabled: ViewStyle;
  submitButtonText: TextStyle;
  modalOverlay: ViewStyle;
  modalBox: ViewStyle;
  modalText: TextStyle;
  modalButton: ViewStyle;
  modalButtonText: TextStyle;
  imagePickerContainer: ViewStyle;
  imagePreview: ImageStyle;
  noImageText: TextStyle;
  imageButtonContainer: ViewStyle;
  imageButton: ViewStyle;
  imageButtonDisabled: ViewStyle;
  imageButtonText: TextStyle;
  dropdownButton: ViewStyle;
  dropdownButtonText: TextStyle;
  dropdownOverlay: ViewStyle;
  dropdownContainer: ViewStyle;
  dropdownItem: ViewStyle;
  dropdownItemText: TextStyle;
  dropdownCancel: ViewStyle;
  dropdownCancelText: TextStyle;
  fieldWrapper: ViewStyle;
  errorBorder: ViewStyle;
  errorText: TextStyle;
  geoHintText: TextStyle;
}>({
  safeContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 24,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: { fontSize: 18, fontWeight: "bold", marginVertical: 8 },
  jobDescList: { maxHeight: 50, marginBottom: 15 },
  jobItem: {
    backgroundColor: "#eee",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 15,
    marginRight: 10,
  },
  jobItemSelected: { backgroundColor: "#007bff" },
  jobItemDisabled: { opacity: 0.5 },
  jobItemText: { color: "#000" },
  jobItemTextSelected: { color: "#fff" },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginBottom: 0,
  },
  fieldWrapper: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 0,
    marginBottom: 4,
  },
  errorBorder: {
    borderColor: "#e53935",
  },
  textInput: {
    borderWidth: 0,
    paddingHorizontal: 12,
    fontSize: 16,
    height: 40,
    marginBottom: 0,
  },
  errorText: {
    color: "#e53935",
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
  },
  geoHintText: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: "#007bff",
    paddingVertical: 14,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#66b0ff",
    opacity: 0.7,
  },
  submitButtonText: { color: "#fff", fontWeight: "bold", fontSize: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 10,
    alignItems: "center",
    width: 280,
  },
  modalText: { fontSize: 20, marginBottom: 20, textAlign: "center" },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  modalButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  imagePickerContainer: {
    marginBottom: 15,
    alignItems: "center",
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  noImageText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
  },
  imageButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 300,
  },
  imageButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
  },
  imageButtonDisabled: {
    backgroundColor: "#66b0ff",
    opacity: 0.7,
  },
  imageButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  dropdownButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownContainer: {
    width: "85%",
    maxHeight: "65%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownCancel: {
    marginTop: 10,
    paddingVertical: 12,
    backgroundColor: "#007bff",
    borderRadius: 8,
    alignItems: "center",
  },
  dropdownCancelText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
