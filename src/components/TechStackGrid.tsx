import { useState } from 'react';

interface Technology {
  name: string;
  category: string;
  description?: string;
  icon?: string;
}

interface TechStackGridProps {
  technologies: Technology[];
}

export default function TechStackGrid({ technologies }: TechStackGridProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group technologies by category
  const groupedTech = technologies.reduce((acc, tech) => {
    if (!acc[tech.category]) {
      acc[tech.category] = [];
    }
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<string, Technology[]>);

  const getCategoryColor = (category: string) => {
    // Use theme-aware colors that work with all themes
    const colors: Record<string, string> = {
      'Client-Side': 'rgba(var(--accent-rgb), 0.08)',
      'Server-Side': 'rgba(var(--accent-rgb), 0.12)',
      'Shared': 'rgba(var(--accent-rgb), 0.06)',
      'Tools': 'rgba(var(--accent-rgb), 0.10)',
    };
    return colors[category] || 'rgba(var(--accent-rgb), 0.08)';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Client-Side': '🎨',
      'Server-Side': '⚙️',
      'Shared': '🔗',
      'Tools': '🛠️',
    };
    return icons[category] || '📦';
  };

  return (
    <div className="tech-stack-grid space-y-8 my-12">
      {Object.entries(groupedTech).map(([category, techs], categoryIndex) => (
        <div key={category} className="category-section">
          {/* Category Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{getCategoryIcon(category)}</span>
            <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {category}
            </h3>
            <div className="flex-1 h-0.5 ml-4" style={{ backgroundColor: 'var(--accent)', opacity: 0.2 }} />
          </div>

          {/* Technology Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {techs.map((tech, index) => {
              const globalIndex = categoryIndex * 100 + index;
              const isHovered = hoveredIndex === globalIndex;

              return (
                <div
                  key={index}
                  className="tech-card relative overflow-hidden rounded-lg p-4 cursor-pointer transition-all duration-300 group"
                  style={{
                    backgroundColor: getCategoryColor(category),
                    border: isHovered
                      ? '2px solid var(--accent)'
                      : '1px solid rgba(var(--accent-rgb), 0.1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  }}
                  onMouseEnter={() => setHoveredIndex(globalIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Animated background */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(135deg, rgba(var(--accent-rgb), 0.05) 0%, rgba(var(--accent-rgb), 0.1) 100%)`,
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon & Name */}
                    <div className="flex items-center gap-3 mb-2">
                      {tech.icon && <span className="text-2xl">{tech.icon}</span>}
                      <h4 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {tech.name}
                      </h4>
                    </div>

                    {/* Description */}
                    {tech.description && (
                      <p
                        className={`
                          text-sm
                          transition-all duration-300
                          ${isHovered ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
                          overflow-hidden
                        `}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {tech.description}
                      </p>
                    )}
                  </div>

                  {/* Hover indicator */}
                  <div
                    className="absolute bottom-0 left-0 h-1 transition-all duration-300"
                    style={{
                      width: isHovered ? '100%' : '0%',
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
