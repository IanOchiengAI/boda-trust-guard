import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.37427556aa0540c1a19c868385cb9f6b',
  appName: 'boda-trust-guard',
  webDir: 'dist',
  server: {
    url: 'https://37427556-aa05-40c1-a19c-868385cb9f6b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;