import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver loop errors that occur during normal UI rendering
// These errors don't affect functionality and are caused by layout recalculations
// This comprehensive fix handles both window errors and React's error overlay
const resizeObserverErrMessage = 'ResizeObserver loop';

// Suppress in window error event
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes(resizeObserverErrMessage)) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    return false;
  }
});

// Suppress in unhandled rejection
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes(resizeObserverErrMessage)) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    return false;
  }
});

// Override console.error to filter out ResizeObserver errors
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes(resizeObserverErrMessage)) {
    return;
  }
  if (args[0] && args[0] instanceof Error && args[0].message && args[0].message.includes(resizeObserverErrMessage)) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
