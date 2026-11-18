import { createRoot } from "react-dom/client";
// @ts-ignore - font stylesheet side-effect import
import "@fontsource-variable/inter";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
