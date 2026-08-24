import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MotionDiv } from "@/components/ui/motion";

export default async function BotsPage() {
  const t = await getTranslations("bots");
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
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/bots/new">
          <Button>{t("create")}</Button>
        </Link>
      </div>

      {!bots || bots.length === 0 ? (
        <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-600 dark:text-gray-300">{t("empty")}</p>
        </MotionDiv>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot, index) => (
            <MotionDiv
              key={bot.id}
              delay={index * 0.05}
              className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{bot.name}</h3>
                  {bot.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                      {bot.description}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    bot.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {bot.is_active ? t("active") : t("inactive")}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  {tc("status")}: {bot.language}
                </p>
                <p>
                  {t("model")}: {bot.model}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <Link href={`/bots/${bot.id}/edit`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    {tc("edit")}
                  </Button>
                </Link>
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </div>
  );
}