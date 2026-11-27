// Dynamic layer over app.json (Expo passes app.json in as `config`).
//
// Android release builds (EAS preview/production APK/AAB) block plain-HTTP
// requests by default; Expo Go doesn't, which is why "works in Expo Go,
// silently fails in the APK" happens. Cleartext is enabled only when the API
// URL the build is bundled with is http:// — an https:// backend keeps the
// secure default.
//
// Keep DEFAULT_API_URL in sync with src/config.ts (config files can't import TS).
const DEFAULT_API_URL = 'http://192.168.0.117:8000';

module.exports = ({ config }) => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim() || DEFAULT_API_URL;
  const cleartext = apiUrl.startsWith('http://');

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }],
    ],
  };
};
