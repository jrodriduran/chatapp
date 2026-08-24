"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface MotionDivProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  initial?: { opacity?: number; y?: number };
  animate?: { opacity?: number; y?: number };
}

export function MotionDiv({
  children,
  className,
  delay = 0,
  duration = 0.4,
  initial = { opacity: 0, y: 20 },
  animate = { opacity: 1, y: 0 },
}: MotionDivProps) {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={{ delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionTr({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.tr>
  );
}

export { motion, AnimatePresence };