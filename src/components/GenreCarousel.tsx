import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './GenreCarousel.css';

type Genre = {
  name: string;
  subtitle: string;
  color: string;
  glow: string;
};

const genres: Genre[] = [
  { name: 'Lo-fi', subtitle: 'warm tape dust', color: 'rgba(255, 255, 255, 0.13)', glow: 'rgba(255, 255, 255, 0.34)' },
  { name: 'Phonk', subtitle: 'chrome drift bass', color: 'rgba(255, 255, 255, 0.18)', glow: 'rgba(255, 255, 255, 0.38)' },
  { name: 'Jazz', subtitle: 'blue room swing', color: 'rgba(255, 255, 255, 0.12)', glow: 'rgba(255, 255, 255, 0.32)' },
  { name: 'EDM', subtitle: 'festival voltage', color: 'rgba(255, 255, 255, 0.14)', glow: 'rgba(255, 255, 255, 0.36)' },
  { name: 'Trap', subtitle: 'heavy night pulse', color: 'rgba(255, 255, 255, 0.11)', glow: 'rgba(255, 255, 255, 0.34)' },
  { name: 'Ambient', subtitle: 'slow air bloom', color: 'rgba(255, 255, 255, 0.10)', glow: 'rgba(255, 255, 255, 0.30)' }
];
const ringGenres = Array.from({ length: 24 }, (_, index) => genres[index % genres.length]);

gsap.registerPlugin(ScrollTrigger);

export default function GenreCarousel() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const ring = ringRef.current;
    if (!section || !ring) return;

    const angle = 360 / ringGenres.length;

    const ctx = gsap.context(() => {
      gsap.set(ring, {
        rotationY: 0,
        rotationX: -24,
        transformPerspective: 1200,
        transformStyle: 'preserve-3d'
      });

      gsap.to(ring, {
        rotationY: -360,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=2800',
          pin: true,
          scrub: 1.25,
          anticipatePin: 1,
          onUpdate: (self) => {
            const rotationY = self.progress * -360;
            const nextIndex = ((Math.round(-rotationY / angle) % ringGenres.length) + ringGenres.length) % ringGenres.length;
            setActiveIndex(nextIndex);
          }
        }
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section className="genre-carousel-section" ref={sectionRef} aria-label="Genre carousel">
      <div className="genre-carousel-pin">
        <div className="genre-carousel-header">
          <div>
            <div className="genre-carousel-kicker">Scroll selector / 3D genre ring</div>
            <h2 className="genre-carousel-title">Genres</h2>
          </div>
          <div className="genre-carousel-progress">
            {String((activeIndex % genres.length) + 1).padStart(2, '0')} / {String(genres.length).padStart(2, '0')}
          </div>
        </div>

        <div className="genre-carousel-stage">
          <div className="genre-ring-floor" aria-hidden="true" />
          <div className="genre-carousel-ring" ref={ringRef}>
            {ringGenres.map((genre, index) => (
              <article
                className={`genre-card${index === activeIndex ? ' is-active' : ''}`}
                key={`${genre.name}-${index}`}
                style={{
                  '--card-angle': `${index * (360 / ringGenres.length)}deg`,
                  '--genre-color': genre.color,
                  '--genre-glow': genre.glow,
                  '--art-x': `${26 + ((index * 17) % 48)}%`,
                  '--art-y': `${28 + ((index * 11) % 42)}%`,
                  '--art-spin': `${(index * 37) % 360}deg`
                } as React.CSSProperties}
              >
                <div className="genre-card-inner">
                  <div className="genre-card-visual" />
                  <div className="genre-card-meta">
                    <h3 className="genre-card-name">{genre.name}</h3>
                    <p className="genre-card-sub">{genre.subtitle}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="genre-carousel-hint">Scroll to rotate</div>
      </div>
    </section>
  );
}
