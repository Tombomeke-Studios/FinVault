import { registerRootComponent } from 'expo';
import App from './App';

// Catch unhandled promise rejections so they appear as readable errors
// in the app instead of silent crashes in production builds.
const globalAny = global as any;
const prev = globalAny.ErrorUtils?.getGlobalHandler?.();
globalAny.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
  console.error('[GlobalHandler] Fatal:', isFatal, error?.message, error?.stack);
  prev?.(error, isFatal);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

