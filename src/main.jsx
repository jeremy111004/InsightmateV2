import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// ⬇️ utilise AppModular, pas App / AppSafeCopy
import AppModular from "./AppModular.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppModular />
  </React.StrictMode>
);
