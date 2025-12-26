import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver loop errors that occur during normal UI rendering
// These errors don't affect functionality and are caused by layout recalculations
const resizeObserverError = (e) => {
  if (e.message && e.message.includes('ResizeObserver loop')) {
    e.stopImmediatePropagation();
  }
};
window.addEventListener('error', resizeObserverError);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
