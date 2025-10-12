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

  const hoverVariants = {
    scale: 1.02,
    y: -5,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  };

  const Component = href ? motion.a : motion.div;
  const extraProps = href ? { href } : {};

  return (
    <Component
      {...extraProps}
      className={`block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      whileHover={hoverVariants}
      variants={cardVariants}
    >
      {children}
    </Component>
  );
}
