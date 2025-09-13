"use client";

import { usePathname } from 'next/navigation';
import StaggeredMenu from './StaggeredMenu';

const menuItems = [
  { label: 'Analysis', ariaLabel: 'Audio Analysis', link: '/analysis' },
  { label: 'Beats', ariaLabel: 'Beat Generator', link: '/beats' },
  { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
  { label: 'Editing', ariaLabel: 'Audio Editing', link: '/editing' },
  { label: '3D Sound', ariaLabel: '3D Sound Editor', link: '/3d-sound-editor' },
  { label: 'Plugin Matcher', ariaLabel: 'Plugin Sound Matcher', link: '/plugin-sound-matcher' }
];

const socialItems = [
  { label: 'Twitter', link: 'https://twitter.com' },
  { label: 'GitHub', link: 'https://github.com' },
  { label: 'LinkedIn', link: 'https://linkedin.com' }
];

interface ConditionalNavProps {
  children: React.ReactNode;
}

export default function ConditionalNav({ children }: ConditionalNavProps) {
  const pathname = usePathname();
  
  // On home page, just render children without navigation
  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-screen">
      {children}
      <div className="fixed top-0 right-0 w-full h-screen pointer-events-none z-[9999]">
        <StaggeredMenu
          position="right"
          items={menuItems}
          socialItems={socialItems}
          displaySocials={true}
          displayItemNumbering={true}
          menuButtonColor="#fff"
          openMenuButtonColor="#000"
          changeMenuColorOnOpen={true}
          colors={['#B19EEF', '#5227FF']}
          logoUrl="/logo.svg"
          accentColor="#ff6b6b"
          onMenuOpen={() => console.log('Menu opened')}
          onMenuClose={() => console.log('Menu closed')}
        />
      </div>
    </div>
  );
}