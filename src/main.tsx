import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { queryClient } from "@/manus/lib/query-client";
import CrossTabQuerySync from "@/manus/components/CrossTabQuerySync";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <CrossTabQuerySync />
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
