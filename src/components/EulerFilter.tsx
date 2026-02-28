import { motion } from 'framer-motion';
import MediaFilterGrid, { type MediaFilterGridConfig } from './MediaFilterGrid';
import ErrorBoundary from './ErrorBoundary';

interface Problem {
  problemNumber: number;
  title: string;
  difficulty?: number;
  solved: boolean;
  solutionLanguage?: string;
}

interface EulerFilterProps {
  problems: Problem[];
}

function EulerFilterInner({ problems }: EulerFilterProps) {
  const config: MediaFilterGridConfig<Problem> = {
    filters: [
      {
        id: 'language',
        label: 'Language',
        options: (items) => [
          { value: 'all', label: 'All Languages' },
          ...[...new Set(items.map(p => p.solutionLanguage).filter(Boolean))]
            .sort()
            .map(l => ({ value: l!, label: l! })),
        ],
        match: (item, value) => value === 'all' || item.solutionLanguage === value,
      },
      {
        id: 'difficulty',
        label: 'Max Difficulty',
        type: 'range',
        min: 0,
        max: 100,
        defaultValue: '100',
        formatLabel: (v) => `${v}%`,
        options: [],
        match: (item, value) => !item.difficulty || item.difficulty <= parseInt(value),
      },
    ],
    sortOptions: [
      { value: 'number', label: 'Problem Number', compare: (a, b) => a.problemNumber - b.problemNumber },
      { value: 'difficulty', label: 'Difficulty', compare: (a, b) => (b.difficulty || 0) - (a.difficulty || 0) },
      { value: 'title', label: 'Title (A-Z)', compare: (a, b) => a.title.localeCompare(b.title) },
    ],
    defaultSort: 'number',
    search: {
      placeholder: 'Problem # or title...',
      match: (item, query) =>
        item.title.toLowerCase().includes(query) ||
        item.problemNumber.toString().includes(query),
    },
    card: {
      getKey: (item) => item.problemNumber.toString(),
      getTitle: (item) => item.title,
      getSubtitle: (item) => `#${item.problemNumber}`,
      getImage: () => '',
    },
    renderItem: (problem) => (
      <motion.a
        href={`/euler/${problem.problemNumber}`}
        className="block p-6 rounded-lg shadow-md border"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        whileHover={{ scale: 1.02, y: -5 }}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
            #{problem.problemNumber}
          </span>
          {problem.difficulty && (
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {problem.difficulty}%
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {problem.title}
        </h3>
        {problem.solutionLanguage && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {problem.solutionLanguage}
            </span>
          </div>
        )}
      </motion.a>
    ),
    gridClassName: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    filterColumnClass: 'lg:grid-cols-4',
    itemNounPlural: 'problems',
  };

  return <MediaFilterGrid items={problems} config={config} />;
}

export default function EulerFilter(props: EulerFilterProps) {
  return <ErrorBoundary sectionName="Project Euler"><EulerFilterInner {...props} /></ErrorBoundary>;
}
