import { useState } from 'react';

interface Video {
  title: string;
  url: string;
  description?: string;
}

interface VideoShowcaseProps {
  videos: Video[];
}

export default function VideoShowcase({ videos }: VideoShowcaseProps) {
  const [activeVideo, setActiveVideo] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleVideoChange = (index: number) => {
    if (index === activeVideo) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveVideo(index);
      setIsTransitioning(false);
    }, 150);
  };

  const currentVideoId = getYouTubeId(videos[activeVideo].url);

  return (
    <div className="video-showcase my-12">
      {/* Video Counter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Video {activeVideo + 1} of {videos.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Video Player */}
      <div className="main-video-container relative rounded-2xl overflow-hidden mb-8 shadow-2xl">
        <div className="video-wrapper relative">
          <div
            className={`relative w-full bg-black transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
            style={{ paddingBottom: '56.25%' }}
          >
            {currentVideoId && (
              <iframe
                key={`video-${activeVideo}`}
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${currentVideoId}`}
                title={videos[activeVideo].title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 0 }}
              />
            )}
          </div>
        </div>

        {/* Video Info Bar */}
        <div className="video-info-bar relative p-6 border-t" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                {videos[activeVideo].title}
              </h3>
              {videos[activeVideo].description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {videos[activeVideo].description}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <div className="px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                Playing
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnails Grid */}
      {videos.length > 1 && (
        <div>
          <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            All Videos
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {videos.map((video, index) => {
              const videoId = getYouTubeId(video.url);
              const isActive = index === activeVideo;

              return (
                <button
                  key={index}
                  onClick={() => handleVideoChange(index)}
                  className="thumbnail-card group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                  data-active={isActive}
                >
                  {/* Thumbnail Image */}
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                      alt={video.title}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    />

                    {/* Overlay */}
                    <div className={`
                      absolute inset-0 transition-all duration-300
                      ${isActive
                        ? 'bg-gradient-to-t from-black/80 via-transparent'
                        : 'bg-transparent md:group-hover:bg-black/30'
                      }
                    `}>
                      {/* Small play badge - mobile only */}
                      {!isActive && (
                        <div className="absolute top-2 left-2 md:hidden">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center border"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)' }}
                          >
                            <svg
                              className="w-3 h-3"
                              style={{ transform: 'translateX(0.5px)', fill: 'var(--accent)' }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Full play button - desktop hover only */}
                      {!isActive && (
                        <div className="absolute inset-0 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center border-2 transition-transform duration-300 group-hover:scale-110"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)' }}
                          >
                            <svg
                              className="w-5 h-5"
                              style={{ transform: 'translateX(1px)', fill: 'var(--accent)' }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Active Indicator */}
                      {isActive && (
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }}></div>
                            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                              Now Playing
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div
                    className="p-3 transition-colors duration-300"
                    style={{
                      backgroundColor: isActive
                        ? 'rgba(var(--accent-rgb), 0.1)'
                        : 'var(--bg-card)'
                    }}
                  >
                    <p
                      className="text-xs font-medium text-left line-clamp-2 leading-snug"
                      style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {video.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .video-showcase {
          container-type: inline-size;
        }

        .main-video-container {
          background: linear-gradient(145deg, rgba(0,0,0,0.95), rgba(20,20,20,0.95));
        }

        .main-video-container::before {
          content: '';
          position: absolute;
          inset: -2px;
          background: linear-gradient(45deg, var(--accent), var(--accent-hover), var(--accent));
          border-radius: 1rem;
          opacity: 0.15;
          z-index: -1;
        }

        .thumbnail-card {
          background: transparent;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .thumbnail-card:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .thumbnail-card[data-active="true"] {
          box-shadow: 0 0 0 3px var(--accent), 0 20px 25px -5px rgba(0, 0, 0, 0.2);
        }

        @container (max-width: 768px) {
          .thumbnail-card p {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
