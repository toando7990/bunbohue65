import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DEVELOPER_PRINCIPAL_ID } from "@/config/constants";
import {
  useGetDeveloperProfile,
  useUpsertDeveloperProfile,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { Principal } from "@icp-sdk/core/principal";
import { Check, ClipboardCopy, Code2, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function isValidPrincipal(value: string): boolean {
  if (!value.trim()) return false;
  try {
    Principal.fromText(value.trim());
    return true;
  } catch {
    return false;
  }
}

export default function DeveloperProfilePage() {
  const { t } = useLanguage();
  const dp = t.developerProfile;

  const developerPrincipalId = DEVELOPER_PRINCIPAL_ID;

  const { data: profile, isLoading } = useGetDeveloperProfile();
  const upsert = useUpsertDeveloperProfile();

  const [businessOwnerPrincipalId, setBusinessOwnerPrincipalId] = useState("");
  const [email, setEmail] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [principalError, setPrincipalError] = useState("");

  useEffect(() => {
    if (!initialized) {
      if (profile) {
        // toText() may return the anonymous principal '2vxsx-fae' if unset
        const principalText = (() => {
          try {
            const t = profile.businessOwnerPrincipalId?.toText() ?? "";
            return t === "2vxsx-fae" ? "" : t;
          } catch {
            return "";
          }
        })();
        setBusinessOwnerPrincipalId(principalText);
        setEmail(profile.email ?? "");
        setInitialized(true);
      } else if (!isLoading) {
        setInitialized(true);
      }
    }
  }, [profile, isLoading, initialized]);

  const handleCopy = async () => {
    if (!developerPrincipalId) return;
    await navigator.clipboard.writeText(developerPrincipalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrincipalError("");

    // Business owner principal is required when saving
    const trimmedPrincipal = businessOwnerPrincipalId.trim();
    if (trimmedPrincipal && !isValidPrincipal(trimmedPrincipal)) {
      setPrincipalError(dp.principalInvalid);
      return;
    }
    if (!trimmedPrincipal) {
      setPrincipalError(dp.principalInvalid);
      return;
    }

    try {
      await upsert.mutateAsync({
        businessOwnerPrincipalId: Principal.fromText(trimmedPrincipal),
        email: email.trim(),
      });
      toast.success(dp.profileSaved);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`${dp.profileError}: ${message}`);
    }
  };

  return (
    <AdminLayout>
      <div data-ocid="developer-profile.page" className="max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl text-foreground">{dp.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{dp.subtitle}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {isLoading ? (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Field 1: Developer Principal ID (read-only + copyable) */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="dev-principalId"
                  className="flex items-center gap-1.5"
                >
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {dp.developerPrincipalId}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="dev-principalId"
                    readOnly
                    value={developerPrincipalId}
                    className="font-mono text-sm bg-muted/50 text-muted-foreground cursor-default select-all"
                    data-ocid="developer-profile.developer_principal_input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={handleCopy}
                    aria-label={copied ? dp.copied : dp.copy}
                    data-ocid="developer-profile.copy_button"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-600">
                          {dp.copied}
                        </span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="h-3.5 w-3.5" />
                        <span className="text-xs">{dp.copy}</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {dp.developerPrincipalIdHint}
                </p>
              </div>

              {/* Field 2: Business Owner Principal ID (editable) */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="dev-businessOwnerPrincipalId"
                  className="flex items-center gap-1.5"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {dp.businessOwnerPrincipalId}
                </Label>
                <Input
                  id="dev-businessOwnerPrincipalId"
                  placeholder={dp.businessOwnerPrincipalIdPlaceholder}
                  value={businessOwnerPrincipalId}
                  onChange={(e) => {
                    setBusinessOwnerPrincipalId(e.target.value);
                    if (principalError) setPrincipalError("");
                  }}
                  className={principalError ? "border-destructive" : ""}
                  data-ocid="developer-profile.business_owner_principal_input"
                />
                {principalError && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="developer-profile.principal_field_error"
                  >
                    {principalError}
                  </p>
                )}
              </div>

              {/* Field 3: Email */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="dev-email"
                  className="flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {dp.email}
                </Label>
                <Input
                  id="dev-email"
                  type="email"
                  placeholder={dp.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-ocid="developer-profile.email_input"
                />
              </div>

              {/* Save */}
              <div className="pt-2 border-t border-border">
                <Button
                  type="submit"
                  disabled={upsert.isPending}
                  data-ocid="developer-profile.save_button"
                >
                  {upsert.isPending ? dp.saving : dp.saveProfile}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
