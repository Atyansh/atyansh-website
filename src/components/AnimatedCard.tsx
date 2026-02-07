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
        ease: 'easeOut' as const
      }
    }
  };

  // Only apply hover animation to non-link cards to avoid interfering with navigation
  const hoverVariants = href ? {} : {
    scale: 1.02,
    y: -5,
    transition: {
      duration: 0.2,
      ease: 'easeInOut' as const
    }
  };

  // If href is provided, use a simple div with anchor tag (no hover animation to avoid click issues)
  if (href) {
    return (
      <motion.div
        className="h-full overflow-hidden md:overflow-visible"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={cardVariants}
      >
        <a
          href={href}
          className={`block p-6 rounded-lg shadow-md border transition-transform hover:scale-[1.02] hover:-translate-y-1 overflow-hidden md:overflow-visible ${className}`}
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {children}
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`block p-6 rounded-lg shadow-md border overflow-hidden md:overflow-visible ${className}`}
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
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
