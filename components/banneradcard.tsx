// components/BannerAdCard.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

const AD_ID = "ca-app-pub-3940256099942544/6300978111"; // Test banner ID

export default function BannerAdCard() {
  return (
    <View style={styles.card}>
      <BannerAd
        unitId={AD_ID}
        size={BannerAdSize.LARGE_BANNER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
});
