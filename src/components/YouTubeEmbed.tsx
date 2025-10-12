interface Video {
  title: string;
  url: string;
  description?: string;
}

interface YouTubeEmbedProps {
  videos: Video[];
}

export default function YouTubeEmbed({ videos }: YouTubeEmbedProps) {
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  return (
    <div className="youtube-grid space-y-8">
      {videos.map((video, index) => {
        const videoId = getYouTubeId(video.url);

        return (
          <div key={index} className="video-container">
            {/* Video Title */}
            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
              {video.title}
            </h3>
            {video.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {video.description}
              </p>
            )}

            {/* YouTube Embed */}
            <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
