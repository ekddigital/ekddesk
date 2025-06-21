import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Get the root element
const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

// Create root and render app
const root = createRoot(container);
root.render(<App />);

// Log that renderer started
console.log("EKD Desk Desktop Client renderer started");
