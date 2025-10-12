import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  href?: string;
  className?: string;
  delay?: number;
}

export default function AnimatedCard({ children, href, className = '', delay = 0 }: AnimatedCardProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: delay,
        ease: 'easeOut'
      }
    }
  };

  // Only apply hover animation to non-link cards to avoid interfering with navigation
  const hoverVariants = href ? {} : {
    scale: 1.02,
    y: -5,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  };

  // If href is provided, use a simple div with anchor tag (no hover animation to avoid click issues)
  if (href) {
    return (
      <motion.div
        className="h-full"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={cardVariants}
      >
        <a
          href={href}
          className={`block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-transform hover:scale-[1.02] hover:-translate-y-1 ${className}`}
        >
          {children}
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      whileHover={hoverVariants}
      variants={cardVariants}
    >
      {children}
    </motion.div>
  );
}
