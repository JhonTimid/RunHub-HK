import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Capacitor: wait for the native layer to be ready before rendering
const startApp = () => {
  if (!window.location.hash) {
    window.location.hash = "#/";
  }
  createRoot(document.getElementById("root")!).render(<App />);
};

// If running inside Capacitor (iOS/Android), wait for deviceready
if ((window as any).Capacitor?.isNativePlatform?.()) {
  document.addEventListener("deviceready", startApp, false);
} else {
  startApp();
}
