import { useState } from 'react';

interface TimelineItem {
  week: string;
  title: string;
  accomplishments: string[];
  mood?: number; // 1-10
}

interface WeeklyTimelineProps {
  items: TimelineItem[];
}

export default function WeeklyTimeline({ items }: WeeklyTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getMoodEmoji = (mood?: number) => {
    if (!mood) return '';
    if (mood >= 9) return '🤩';
    if (mood >= 7) return '😊';
    if (mood >= 5) return '😐';
    return '😰';
  };

  return (
    <div className="weekly-timeline space-y-4">
      {items.map((item, index) => {
        const isExpanded = expandedItems.has(index);

        return (
          <div
            key={index}
            className="timeline-item"
          >
            {/* Expandable Header */}
            <button
              onClick={() => toggleItem(index)}
              className="w-full text-left transition-all duration-200"
            >
              <div
                className="rounded-xl p-5 shadow-md hover:shadow-lg transition-all duration-200"
                style={{
                  background: isExpanded
                    ? 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(var(--accent-rgb), 0.05) 100%)'
                    : 'var(--bg-card)',
                  border: `1px solid rgba(var(--accent-rgb), ${isExpanded ? '0.3' : '0.15'})`,
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left side: Week badge + Title */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap flex-shrink-0 border"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      {item.week}
                    </span>
                    <h3 className="text-lg md:text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Right side: Mood + Arrow */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.mood && (
                      <span className="text-2xl" title={`Mood: ${item.mood}/10`}>
                        {getMoodEmoji(item.mood)}
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--accent)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* Expandable Content */}
            <div
              className={`overflow-hidden transition-all duration-300 ${
                isExpanded ? 'max-h-[1000px] opacity-100 mt-2' : 'max-h-0 opacity-0'
              }`}
            >
              <div
                className="rounded-xl p-6 ml-0 md:ml-4"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(var(--accent-rgb), 0.1)',
                }}
              >
                <ul className="space-y-3">
                  {item.accomplishments.map((accomplishment, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm md:text-base"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="flex-shrink-0 mt-1" style={{ color: 'var(--accent)' }}>▸</span>
                      <span className="leading-relaxed">{accomplishment}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        .weekly-timeline {
          width: 100%;
          max-width: 100%;
        }

        .timeline-item {
          width: 100%;
        }

        @media (max-width: 640px) {
          .timeline-item h3 {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
