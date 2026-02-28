import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import * as Location from "expo-location"
import ModalSheet from "./ModalSheet"
import { useAlert } from "./CustomAlert"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectedLocation {
  lat: number
  lng: number
  address: string
  radius: number
}

interface CreatineLocationPickerProps {
  visible: boolean
  onClose: () => void
  onLocationSelected: (location: SelectedLocation) => void
  initialLocation?: Partial<SelectedLocation> | null
}

interface MarkerPosition {
  latitude: number
  longitude: number
}

interface NominatimAddress {
  road?: string
  house_number?: string
  suburb?: string
  city?: string
  state?: string
  country?: string
}

interface WebViewMessage {
  type: "mapClick" | "mapReady"
  lat?: number
  lng?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreatineLocationPicker({
  visible,
  onClose,
  onLocationSelected,
  initialLocation,
}: CreatineLocationPickerProps) {
  const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(
    null,
  )
  const [address, setAddress] = useState("")
  const [radius, setRadius] = useState(200)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const webViewRef = useRef<WebView>(null)
  const { alert, AlertComponent } = useAlert()

  useEffect(() => {
    if (visible) void initializeLocation()
  }, [visible])

  const initializeLocation = async () => {
    setLoading(true)
    try {
      if (initialLocation?.lat && initialLocation.lng) {
        const lat = parseFloat(String(initialLocation.lat))
        const lng = parseFloat(String(initialLocation.lng))

        if (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          setMarkerPosition({ latitude: lat, longitude: lng })
          setAddress(initialLocation.address ?? "")
          setRadius(initialLocation.radius ?? 200)

          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`
              if (typeof map !== 'undefined') {
                map.setView([${lat}, ${lng}], 15);
                updateMarker(${lat}, ${lng}, ${initialLocation.radius ?? 200});
              }
              true;
            `)
          }, 500)
        } else {
          await useCurrentLocation()
        }
      } else {
        await useCurrentLocation()
      }
    } catch (error) {
      console.error("Error initializing location:", error)
      alert("Error", "Could not get your location", [{ text: "OK" }], "error")
    }
  }

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        alert(
          "Permission Required",
          "Location access is needed to select a reminder location",
          [{ text: "OK" }],
          "warning",
        )
        setLoading(false)
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const { latitude, longitude } = location.coords

      setMarkerPosition({ latitude, longitude })

      webViewRef.current?.injectJavaScript(`
        if (typeof map !== 'undefined') {
          map.setView([${latitude}, ${longitude}], 15);
          updateMarker(${latitude}, ${longitude}, ${radius});
        }
        true;
      `)

      await fetchAddressFromCoords(latitude, longitude)
    } catch (error) {
      console.error("Error getting current location:", error)
      alert(
        "Error",
        "Could not get your current location",
        [{ text: "OK" }],
        "error",
      )
      setLoading(false)
    }
  }

  const fetchAddressFromCoords = async (
    latitude: number,
    longitude: number,
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        { headers: { "User-Agent": "CreatineFitnessApp/1.0" } },
      )
      const data = (await response.json()) as {
        display_name?: string
        address?: NominatimAddress
      }

      if (data.display_name) {
        setAddress(data.display_name)
      } else if (data.address) {
        setAddress(formatNominatimAddress(data.address))
      } else {
        setAddress("Selected Location")
      }
    } catch {
      setAddress("Selected Location")
    }
  }

  const formatNominatimAddress = (addressData: NominatimAddress): string => {
    const parts: string[] = []
    if (addressData.road) parts.push(addressData.road)
    if (addressData.house_number) parts.push(addressData.house_number)
    if (addressData.suburb) parts.push(addressData.suburb)
    if (addressData.city) parts.push(addressData.city)
    if (addressData.state) parts.push(addressData.state)
    if (addressData.country) parts.push(addressData.country)
    return parts.join(", ") || "Selected Location"
  }

  const handleAddressSearch = async () => {
    if (!address.trim()) {
      alert(
        "Enter Address",
        "Please enter an address to search",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    setSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { "User-Agent": "CreatineFitnessApp/1.0" } },
      )
      const data = (await response.json()) as Array<{
        lat: string
        lon: string
        display_name?: string
      }>

      if (data.length > 0 && data[0]) {
        const { lat, lon } = data[0]
        const latitude = parseFloat(lat)
        const longitude = parseFloat(lon)

        setMarkerPosition({ latitude, longitude })

        webViewRef.current?.injectJavaScript(`
          if (typeof map !== 'undefined') {
            map.setView([${latitude}, ${longitude}], 15);
            updateMarker(${latitude}, ${longitude}, ${radius});
          }
          true;
        `)

        if (data[0].display_name) setAddress(data[0].display_name)
      } else {
        alert(
          "Not Found",
          "Could not find that address. Try being more specific.",
          [{ text: "OK" }],
          "warning",
        )
      }
    } catch {
      alert(
        "Error",
        "Could not search for that address. Please check your internet connection.",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSearching(false)
    }
  }

  const handleCurrentLocation = async () => {
    setLoading(true)
    try {
      await useCurrentLocation()
    } catch {
      alert(
        "Error",
        "Could not get your current location",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!markerPosition) {
      alert(
        "Select Location",
        "Please select a location on the map",
        [{ text: "OK" }],
        "warning",
      )
      return
    }

    onLocationSelected({
      lat: markerPosition.latitude,
      lng: markerPosition.longitude,
      address: address || "Selected Location",
      radius,
    })
    onClose()
  }

  const adjustRadius = (change: number) => {
    const newRadius = Math.max(50, Math.min(1000, radius + change))
    setRadius(newRadius)

    if (markerPosition) {
      webViewRef.current?.injectJavaScript(`
        if (typeof updateMarker !== 'undefined') {
          updateMarker(${markerPosition.latitude}, ${markerPosition.longitude}, ${newRadius});
        }
        true;
      `)
    }
  }

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as WebViewMessage

      if (data.type === "mapClick" && data.lat != null && data.lng != null) {
        setMarkerPosition({ latitude: data.lat, longitude: data.lng })
        void fetchAddressFromCoords(data.lat, data.lng)
      } else if (data.type === "mapReady") {
        setLoading(false)

        if (markerPosition) {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`
              map.setView([${markerPosition.latitude}, ${markerPosition.longitude}], 15);
              updateMarker(${markerPosition.latitude}, ${markerPosition.longitude}, ${radius});
              true;
            `)
          }, 300)
        }
      }
    } catch (error) {
      console.error("Error parsing WebView message:", error)
    }
  }

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossorigin=""/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; width: 100%; }
        #map { height: 100%; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { center: [37.78825, -122.4324], zoom: 13, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19, minZoom: 3
        }).addTo(map);

        var marker = null; var circle = null;
        function updateMarker(lat, lng, radius) {
          if (marker) { map.removeLayer(marker); }
          if (circle) { map.removeLayer(circle); }
          marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background-color:#667eea;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
              iconSize: [30, 30], iconAnchor: [15, 30]
            })
          }).addTo(map);
          circle = L.circle([lat, lng], { color:'#667eea', fillColor:'#667eea', fillOpacity:0.2, radius:radius, weight:2 }).addTo(map);
        }
        map.on('click', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'mapClick', lat:e.latlng.lat, lng:e.latlng.lng }));
        });
        map.whenReady(function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'mapReady' }));
        });
        if (window.matchMedia("(max-width: 768px)").matches) { map.scrollWheelZoom.disable(); }
      </script>
    </body>
    </html>
  `

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      fullHeight
      showCancelButton={false}
      showConfirmButton={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Reminder Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size='large' color='#667eea' />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: mapHTML }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          onError={(syntheticEvent) => {
            console.error("WebView error:", syntheticEvent.nativeEvent)
            alert(
              "Map Error",
              "Could not load map. Check internet connection.",
              [{ text: "OK" }],
              "error",
            )
          }}
          onHttpError={(syntheticEvent) => {
            console.error(
              "WebView HTTP error:",
              syntheticEvent.nativeEvent.statusCode,
            )
          }}
          originWhitelist={["*"]}
          mixedContentMode='always'
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={() => void handleCurrentLocation()}
          disabled={loading}
        >
          <Text style={styles.currentLocationIcon}>📍</Text>
        </TouchableOpacity>

        <View style={styles.radiusControls}>
          <Text style={styles.radiusLabel}>Radius: {radius}m</Text>
          <View style={styles.radiusButtons}>
            <TouchableOpacity
              style={styles.radiusButton}
              onPress={() => adjustRadius(-50)}
            >
              <Text style={styles.radiusButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radiusButton}
              onPress={() => adjustRadius(50)}
            >
              <Text style={styles.radiusButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.osmNotice}>
          <Text style={styles.osmText}>🗺️ OpenStreetMap</Text>
        </View>
      </View>

      {/* Address Bar */}
      <View style={styles.addressBarContainer}>
        <View style={styles.addressInputContainer}>
          <TextInput
            style={styles.addressInput}
            placeholder='Enter address or tap map'
            placeholderTextColor='#999'
            value={address}
            onChangeText={setAddress}
            onSubmitEditing={() => void handleAddressSearch()}
            returnKeyType='search'
            autoCorrect={false}
            autoCapitalize='words'
          />
          {address.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setAddress("")}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => void handleAddressSearch()}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size='small' color='#667eea' />
            ) : (
              <Text style={styles.searchIcon}>🔍</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            📍 Tap on map or search address
          </Text>
          <Text style={styles.instructionsSubtext}>
            You'll get a reminder within {radius}m of this location
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButtonBottom,
            !markerPosition && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!markerPosition}
        >
          <Text style={styles.saveButtonText}>✓ Save Location</Text>
        </TouchableOpacity>
      </View>

      {AlertComponent}
    </ModalSheet>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cancelButton: { padding: 8 },
  cancelText: { fontSize: 16, color: "#ef4444", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  headerSpacer: { width: 60 },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1, backgroundColor: "#f0f0f0" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  currentLocationButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentLocationIcon: { fontSize: 24 },
  radiusControls: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  radiusButtons: { flexDirection: "row", gap: 8 },
  radiusButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  radiusButtonText: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  osmNotice: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  osmText: { fontSize: 11, color: "#666", fontWeight: "500" },
  addressBarContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  addressInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  addressInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    paddingRight: 8,
    color: "#333",
  },
  clearButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
  },
  clearIcon: { fontSize: 18, color: "#999", fontWeight: "600" },
  searchButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
  },
  searchIcon: { fontSize: 20 },
  instructionsContainer: { alignItems: "center", marginBottom: 12 },
  instructionsText: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  instructionsSubtext: { fontSize: 12, color: "#999", textAlign: "center" },
  saveButtonBottom: {
    backgroundColor: "#667eea",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: { backgroundColor: "#d1d5db", shadowOpacity: 0.1 },
  saveButtonText: { fontSize: 18, fontWeight: "700", color: "#fff" },
})
