import { useEffect, useRef, useState } from 'react';

interface Stat {
  label: string;
  value: string;
  suffix?: string;
  icon?: string;
}

interface ProjectStatsProps {
  stats: Stat[];
}

export default function ProjectStats({ stats }: ProjectStatsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState<number[]>(stats.map(() => 0));
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timers: ReturnType<typeof setInterval>[] = [];
    const durations = stats.map(() => 2000); // 2 seconds for each
    const steps = 60;

    stats.forEach((stat, index) => {
      const numericValue = parseInt(stat.value.replace(/,/g, ''));
      if (isNaN(numericValue)) return;

      const increment = numericValue / steps;
      let current = 0;
      const stepTime = durations[index] / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          setCounts((prev) => {
            const newCounts = [...prev];
            newCounts[index] = numericValue;
            return newCounts;
          });
          clearInterval(timer);
        } else {
          setCounts((prev) => {
            const newCounts = [...prev];
            newCounts[index] = Math.floor(current);
            return newCounts;
          });
        }
      }, stepTime);
      timers.push(timer);
    });

    return () => timers.forEach(t => clearInterval(t));
  }, [isVisible, stats]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  return (
    <div
      ref={statsRef}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 my-8"
    >
      {stats.map((stat, index) => {
        const numericValue = parseInt(stat.value.replace(/,/g, ''));
        const isNumeric = !isNaN(numericValue);

        return (
          <div
            key={index}
            className="stat-card relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(var(--accent-rgb), 0.05) 100%)',
              border: '1px solid rgba(var(--accent-rgb), 0.2)',
              animation: isVisible ? `slideUp 0.6s ease-out ${index * 0.1}s both` : 'none',
            }}
          >
            {/* Background decoration */}
            <div
              className="absolute top-0 right-0 w-20 h-20 opacity-10"
              style={{
                background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
              }}
            />

            {/* Icon */}
            {stat.icon && (
              <div className="text-3xl mb-2 relative z-10">{stat.icon}</div>
            )}

            {/* Value */}
            <div className="text-3xl md:text-4xl font-bold mb-2 relative z-10">
              <span style={{ color: 'var(--accent)' }}>
                {isNumeric && isVisible ? formatNumber(counts[index]) : stat.value}
                {stat.suffix && stat.suffix}
              </span>
            </div>

            {/* Label */}
            <div className="text-sm md:text-base font-medium relative z-10" style={{ color: 'var(--text-secondary)' }}>
              {stat.label}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            transparent 0%,
            rgba(var(--accent-rgb), 0.1) 100%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .stat-card:hover::before {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
