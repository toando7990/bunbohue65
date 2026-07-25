import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useGetSuggestionConfig,
  useSetSuggestionConfig,
} from "@/hooks/useBackend";
import { useEffect, useState } from "react";

export default function SuggestionConfigPage() {
  const { data: config, isLoading } = useGetSuggestionConfig();
  const setConfig = useSetSuggestionConfig();

  const [enabled, setEnabled] = useState(false);
  const [maxAddOns, setMaxAddOns] = useState(2);
  const [maxDrinks, setMaxDrinks] = useState(1);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setEnabled(config.suggestionsEnabled);
      setMaxAddOns(Number(config.maxAddOns));
      setMaxDrinks(Number(config.maxDrinks));
    }
  }, [config]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      const result = await setConfig.mutateAsync({
        suggestionsEnabled: enabled,
        maxAddOns: BigInt(maxAddOns),
        maxDrinks: BigInt(maxDrinks),
      });
      if (result.__kind__ === "err") throw new Error(result.err);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    }
  };

  return (
    <AdminLayout>
      <div
        className="max-w-md mx-auto space-y-6"
        data-ocid="suggestion_config.page"
      >
        <h1 className="text-xl font-semibold text-foreground">Gợi ý món</h1>

        {isLoading ? (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="suggestion_config.loading_state"
          >
            Đang tải...
          </p>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="suggestions-enabled"
                className="text-sm font-medium"
              >
                Bật gợi ý món
              </Label>
              <Switch
                id="suggestions-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                data-ocid="suggestion_config.switch"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-addons" className="text-sm font-medium">
                Số lượng gọi thêm tối đa
              </Label>
              <Input
                id="max-addons"
                type="number"
                min={0}
                max={10}
                value={maxAddOns}
                onChange={(e) => setMaxAddOns(Number(e.target.value))}
                data-ocid="suggestion_config.max_addons_input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-drinks" className="text-sm font-medium">
                Số lượng nước tối đa
              </Label>
              <Input
                id="max-drinks"
                type="number"
                min={0}
                max={10}
                value={maxDrinks}
                onChange={(e) => setMaxDrinks(Number(e.target.value))}
                data-ocid="suggestion_config.max_drinks_input"
              />
            </div>

            {error && (
              <p
                className="text-sm text-destructive"
                data-ocid="suggestion_config.error_state"
              >
                {error}
              </p>
            )}
            {saved && (
              <p
                className="text-sm text-green-600"
                data-ocid="suggestion_config.success_state"
              >
                Đã lưu thành công
              </p>
            )}

            <Button
              type="button"
              className="w-full"
              disabled={setConfig.isPending}
              onClick={handleSave}
              data-ocid="suggestion_config.submit_button"
            >
              {setConfig.isPending ? "Đang lưu..." : "Lưu cài đặt"}
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
