import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

/**
 * EKD Desk Desktop Client - Renderer Entry Point
 * Initializes the React application in the Electron renderer process
 */

// Get the root element
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// Create React root and render the app
const root = createRoot(container);
root.render(<App />);

// Hot Module Replacement (for development)
if ((module as any).hot) {
  (module as any).hot.accept();
}
