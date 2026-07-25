import { useAuthContext } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export default function AdminPage() {
  const { role, isLoading, login } = useAuthContext();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    if (
      role === "developer" ||
      role === "business_owner" ||
      role === "blocked"
    ) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [role, navigate]);

  // While loading → show spinner
  const showSpinner = isLoading;

  if (showSpinner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Any resolved non-unknown role → show spinner while useEffect redirect fires
  if (role !== "unknown") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // role === 'unknown' and not loading → user is not authenticated, show login UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <button
        type="button"
        onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
        className="absolute top-4 right-4 text-xs font-medium px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Toggle language"
        data-ocid="admin.login.language_toggle"
      >
        {language === "vi" ? "EN" : "VI"}
      </button>
      <div
        data-ocid="admin.login.page"
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-md p-8 flex flex-col items-center gap-6 text-center"
      >
        <img
          src="/assets/logo-bunbohue65.png"
          alt="Bunbohue65"
          className="h-12 w-auto"
        />
        <div className="space-y-1">
          <h1 className="font-display text-xl text-foreground">
            {t.adminLogin.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.adminLogin.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => login()}
          data-ocid="admin.login.submit_button"
          className="w-full px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.adminLogin.signInButton}
        </button>
        <p className="text-xs text-muted-foreground">
          {t.adminLogin.description}
        </p>
      </div>
    </div>
  );
}
