import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState<'number' | 'difficulty' | 'title'>('number');

  // Get all unique languages
  const languages = useMemo(() => {
    const langs = [...new Set(problems.map(p => p.solutionLanguage).filter(Boolean))];
    return langs.sort();
  }, [problems]);

  // Filter and sort problems
  const filteredProblems = useMemo(() => {
    let filtered = problems.filter(problem => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.problemNumber.toString().includes(searchQuery);

      // Language filter
      const matchesLanguage =
        selectedLanguage === 'all' ||
        problem.solutionLanguage === selectedLanguage;

      // Difficulty filter
      const matchesDifficulty =
        !problem.difficulty ||
        (problem.difficulty >= difficultyRange[0] && problem.difficulty <= difficultyRange[1]);

      return matchesSearch && matchesLanguage && matchesDifficulty;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'number':
          return a.problemNumber - b.problemNumber;
        case 'difficulty':
          return (b.difficulty || 0) - (a.difficulty || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [problems, searchQuery, selectedLanguage, difficultyRange, sortBy]);

  return (
    <div className="mb-8">
      {/* Filters Section */}
      <div className="rounded-lg shadow-md border p-6 mb-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Filter & Search
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Problem # or title..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Language Filter */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Languages</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Difficulty Range */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Max Difficulty: {difficultyRange[1]}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={difficultyRange[1]}
              onChange={(e) => setDifficultyRange([0, parseInt(e.target.value)])}
              className="w-full theme-slider"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="number">Problem Number</option>
              <option value="difficulty">Difficulty</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredProblems.length} of {problems.length} problems
        </div>
      </div>

      {/* Problems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProblems.map((problem, index) => (
          <motion.a
            key={problem.problemNumber}
            href={`/euler/${problem.problemNumber}`}
            className="block p-6 rounded-lg shadow-md border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="problem-badge text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
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
        ))}
      </div>

      {filteredProblems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No problems match your filters. Try adjusting your search criteria.
          </p>
        </div>
      )}
    </div>
  );
}

export default function EulerFilter(props: EulerFilterProps) {
  return <ErrorBoundary sectionName="Project Euler"><EulerFilterInner {...props} /></ErrorBoundary>;
}
