import React from "react";
import { createRoot } from "react-dom/client";

// Simple test component to verify React is working
const TestApp: React.FC = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>EKD Desk Test</h1>
      <p>If you can see this, React is working!</p>
      <button onClick={() => alert("Button clicked!")}>Test Button</button>
    </div>
  );
};

// Render the test app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<TestApp />);
} else {
  console.error("Root element not found!");
}
