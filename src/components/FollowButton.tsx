import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  className?: string;
}

export default function FollowButton({ isFollowing, isLoading = false, onToggle, className = '' }: FollowButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const label = !isFollowing ? 'متابعة' : isHovered ? 'إلغاء المتابعة' : 'متابَع';
  const icon = !isFollowing ? 'fa-user-plus' : isHovered ? 'fa-user-minus' : 'fa-check';

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      disabled={isLoading}
      className={`group inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-black transition-all duration-200 ${isFollowing
        ? isHovered
          ? 'border-red-200 bg-red-50 text-red-600 shadow-sm'
          : 'border-emerald-200 bg-white text-emerald-700 shadow-sm'
        : 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/15 hover:bg-brand-dark'
        } disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${label}-${icon}`}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ duration: 0.16 }}
          className="inline-flex items-center gap-2"
        >
          <motion.i
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 20, opacity: 0 }}
            className={`fa-solid ${icon} text-xs`}
          />
          <span>{isLoading ? 'جاري التنفيذ...' : label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
