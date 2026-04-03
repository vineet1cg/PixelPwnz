"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { ChevronUpIcon } from "lucide-react";

const ActivityItem = ({ icon, title, desc, time }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-bg-hover/40 sm:gap-4 sm:px-5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge bg-bg-raised text-text-muted sm:h-12 sm:w-12">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] leading-tight font-bold text-text-primary sm:text-[17px]">
          {title}
        </p>
        <p
          className="truncate text-[13px] text-text-secondary sm:text-[15px]">
          {desc}
        </p>
      </div>
      <span
        className="pt-1 text-[11px] whitespace-nowrap text-text-muted sm:text-[13px]">
        {time}
      </span>
    </motion.div>
  );
};

export const ActivitiesCard = ({
  headerIcon,
  title,
  subtitle,
  activities,
  /** e.g. “View all” link — sits before the expand chevron */
  headerAction,
  /** Start expanded (e.g. dashboard) */
  initialOpen = false,
}) => {
  const [open, setOpen] = useState(initialOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <MotionConfig transition={{ type: "spring", bounce: 0, duration: 0.6 }}>
      <motion.div
        layout
        className="w-full overflow-hidden rounded-2xl border border-edge bg-bg-overlay/90 backdrop-blur-xl shadow-2xl">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-bg-hover/20 sm:gap-4 -my-2 py-2 -ml-1 pl-1 pr-2 rounded-xl sm:-my-3 sm:py-3">
            <motion.div
              initial={{
                width: isMobile ? 48 : 60,
                height: isMobile ? 48 : 60,
              }}
              animate={{
                width: open ? (isMobile ? 36 : 48) : isMobile ? 48 : 60,
                height: open ? (isMobile ? 36 : 48) : isMobile ? 48 : 60,
              }}
              className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-edge bg-bg-raised shadow-sm">
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.06),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]" />
              <motion.div animate={{ scale: open ? 0.7 : 1 }}>
                {headerIcon}
              </motion.div>
            </motion.div>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <motion.p
                layout
                className="truncate text-[16px] font-bold tracking-tight text-text-primary sm:text-[17px]">
                {title}
              </motion.p>
              <AnimatePresence mode="popLayout" initial={false}>
                {!open && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                    className="truncate text-[14px] tracking-tight text-text-muted sm:text-[15px]">
                    {subtitle}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {headerAction ? (
              <div className="hidden min-w-0 sm:flex sm:items-center">{headerAction}</div>
            ) : null}
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Collapse activity" : "Expand activity"}
              onClick={() => setOpen(!open)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-edge bg-bg-raised text-text-secondary shadow-xs transition-colors hover:bg-bg-hover/60">
              <motion.div animate={{ rotate: open ? 180 : 0 }}>
                <ChevronUpIcon className="size-5" />
              </motion.div>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-edge">
              <div className="py-2">
                {activities.map((item, i) => (
                  <ActivityItem key={i} {...item} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
};
