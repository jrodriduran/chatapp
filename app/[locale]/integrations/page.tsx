import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MotionDiv } from "@/components/ui/motion";

export default async function IntegrationsPage() {
  const t = await getTranslations("integrations");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  const organizationId = memberships?.organization_id;

  const { data: bots } = organizationId
    ? await supabase
        .from("bots")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
    : { data: [] };

  const { data: integrations } = organizationId
    ? await supabase
        .from("whatsapp_integrations")
        .select("*, bots(name)")
        .eq("organization_id", organizationId)
    : { data: [] };

  const { data: aiConfigs } = organizationId
    ? await supabase
        .from("ai_provider_configs")
        .select("*, bots(name)")
        .eq("organization_id", organizationId)
    : { data: [] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Integration */}
        <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("whatsapp")}</h2>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                integrations && integrations.length > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {integrations && integrations.length > 0
                ? t("whatsappConnected")
                : t("whatsappDisconnected")}
            </span>
          </div>

          {integrations && integrations.length > 0 ? (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div>
                    <p className="font-medium">{integration.bots?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {integration.phone_number_id}
                    </p>
                  </div>
                  <Button variant="danger" size="sm">
                    {t("disconnectWhatsapp")}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t("whatsappDisconnected")}
              </p>
              <Button>{t("connectWhatsapp")}</Button>
            </div>
          )}
        </MotionDiv>

        {/* AI Provider */}
        <MotionDiv
          delay={0.1}
          className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("aiProvider")}</h2>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                aiConfigs && aiConfigs.length > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {aiConfigs && aiConfigs.length > 0
                ? t("aiProviderConnected")
                : t("aiProviderDisconnected")}
            </span>
          </div>

          {aiConfigs && aiConfigs.length > 0 ? (
            <div className="space-y-3">
              {aiConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div>
                    <p className="font-medium">{config.bots?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {config.model}
                    </p>
                  </div>
                  <Button variant="danger" size="sm">
                    {t("disconnectAi")}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t("aiProviderDisconnected")}
              </p>
              <Button>{t("connectAi")}</Button>
            </div>
          )}
        </MotionDiv>
      </div>

      {bots && bots.length > 0 && (
        <MotionDiv
          delay={0.2}
          className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold mb-4">{tc("appName")}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {bots.length} {t("aiProvider")}
          </p>
        </MotionDiv>
      )}
    </div>
  );
}