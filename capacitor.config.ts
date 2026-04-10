import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hk.runhub.app',
  appName: 'RunHub HK',
  webDir: 'dist/public',
  server: {
    // In development, point to your local server
    // Comment this out for production builds (uses bundled web assets)
    // url: 'http://localhost:3000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f1a0e',
  },
  android: {
    backgroundColor: '#0f1a0e',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f1a0e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
