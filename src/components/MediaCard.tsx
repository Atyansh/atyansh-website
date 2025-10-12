import { motion } from 'framer-motion';

interface MediaCardProps {
  title: string;
  subtitle: string;
  image: string;
  rating?: number;
  href?: string;
  tags?: string[];
  delay?: number;
}

export default function MediaCard({
  title,
  subtitle,
  image,
  rating,
  href,
  tags = [],
  delay = 0
}: MediaCardProps) {
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        delay: delay,
        ease: 'easeOut'
      }
    }
  };

  const Component = href ? motion.a : motion.div;
  const extraProps = href ? { href } : {};

  return (
    <Component
      {...extraProps}
      className="group relative overflow-hidden rounded-lg shadow-lg cursor-pointer"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      whileHover={{
        y: -10,
        transition: { duration: 0.2 }
      }}
      variants={cardVariants}
    >
      {/* Image Container */}
      <div className="relative aspect-[2/3] overflow-hidden bg-gray-200 dark:bg-gray-700">
        <motion.img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="font-bold text-lg mb-1 line-clamp-2">{title}</h3>
            <p className="text-sm text-gray-300 mb-2">{subtitle}</p>

            {rating && (
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-500'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-white/20 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Minimal info shown by default */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 group-hover:opacity-0 transition-opacity">
        <h3 className="text-white font-semibold text-sm line-clamp-1">{title}</h3>
      </div>
    </Component>
  );
}
