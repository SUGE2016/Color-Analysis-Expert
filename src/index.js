import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/table-global.css";
import AppRouter from "./router";

// 挂载到根节点
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);