import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthContextProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n";
import { HelmetProvider } from "react-helmet-async";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <InternetIdentityProvider>
        <AuthContextProvider>
          <LanguageProvider>
            <App />
            <Toaster />
          </LanguageProvider>
        </AuthContextProvider>
      </InternetIdentityProvider>
    </QueryClientProvider>
  </HelmetProvider>,
);
