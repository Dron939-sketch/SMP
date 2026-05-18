import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* HashRouter — чтобы ссылки вида /t/<token> работали без
        Render-rewrite. URL получаются c "#", но всё открывается. */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
