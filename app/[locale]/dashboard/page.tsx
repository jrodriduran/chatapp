import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MotionDiv } from "@/components/ui/motion";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const ta = await getTranslations("auth");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  const organization = profile?.organizations;

  // Fetch stats
  const [{ count: botCount }, { count: conversationCount }, { count: messageCount }] =
    await Promise.all([
      profile?.organization_id
        ? supabase
            .from("bots")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id)
        : Promise.resolve({ count: 0 }),
      profile?.organization_id
        ? supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id)
        : Promise.resolve({ count: 0 }),
      profile?.organization_id
        ? supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id)
        : Promise.resolve({ count: 0 }),
    ]);

  const stats = [
    { label: t("activeBots"), value: botCount ?? 0, icon: "🤖" },
    { label: t("totalConversations"), value: conversationCount ?? 0, icon: "💬" },
    { label: t("messagesSent"), value: messageCount ?? 0, icon: "📨" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
        </div>
        <SignOutButton locale={locale} />
      </div>

      <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">
            {user.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-semibold">
              {ta("welcome")}, {profile?.full_name || user.email}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {ta("organization")}: {organization?.name || "-"} · {ta("role")}:{" "}
              {profile?.role || "-"}
            </p>
          </div>
        </div>
      </MotionDiv>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <MotionDiv
            key={stat.label}
            delay={index * 0.1}
            className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <span className="text-3xl" aria-hidden>
                {stat.icon}
              </span>
            </div>
          </MotionDiv>
        ))}
      </div>

      <MotionDiv
        delay={0.3}
        className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold mb-4">{t("recentConversations")}</h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          {tc("empty")}
        </p>
      </MotionDiv>
    </div>
  );
}