"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", key: "dashboard", icon: "📊" },
  { href: "/conversations", key: "conversations", icon: "💬" },
  { href: "/contacts", key: "contacts", icon: "👥" },
  { href: "/integrations", key: "integrations", icon: "🔌" },
  { href: "/settings", key: "settings", icon: "⚙️" },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark flex flex-col">
      <div className="p-6">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          {tc("appName")}
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-light dark:bg-primary/20 text-primary"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {t("theme")}
          </span>
          {mounted && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={t("theme")}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </motion.button>
          )}
        </div>
      </div>
    </aside>
  );
}