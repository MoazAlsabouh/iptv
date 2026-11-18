# 🔒 APPROVED TECH STACK (UNIVERSAL TV & MOBILE)

## Framework & Core
- **Framework:** React Native with Expo (SDK 50+).
- **TV Support:** MUST use `@expo/tv-out-of-tree` or Expo's built-in TV configurations to support Android TV and Apple TV.
- **Language:** TypeScript.
- **Routing:** Expo Router (File-based routing for universal apps).

## UI, Styling & Navigation
- **Styling:** NativeWind (Tailwind CSS for React Native) to ensure identical UI across Web, TV, and Mobile.
- **TV Navigation (CRITICAL):** 
  - Use `TouchableHighlight` or `Pressable` with dynamic styling for the `focused` state.
  - Rely on React Native's TV Focus engine. Elements must clearly highlight when selected via a TV Remote D-Pad.
- **Icons:** `@expo/vector-icons`.

## Media & Streaming
- **Video Player:** `expo-av` or `react-native-video` (Must be the TV-compatible versions that support hardware acceleration and remote control media keys: Play/Pause/FF/RW).
- **Parsing:** Custom lightweight M3U parser in pure TypeScript.

## State & Storage
- **State Management:** Zustand.
- **Storage:** `AsyncStorage` (for Parental Control PIN, Watch History).

*Constraint:* The app MUST be fully navigable using ONLY Arrow Keys and an Enter button (simulating a TV Remote). Touch/Mouse interactions are secondary.