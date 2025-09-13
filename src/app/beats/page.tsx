import Image from "next/image";
import StaggeredMenu from "@/components/StaggeredMenu";

export default function BeatsPage() {
  const menuItems = [
    { label: 'Analysis', ariaLabel: 'Audio Analysis', link: '/analysis' },
    { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
    { label: 'Editing', ariaLabel: 'Audio Editing', link: '/editing' },
    { label: '3D Sound', ariaLabel: '3D Sound Editor', link: '/3d-sound-editor' },
    { label: 'Plugin Matcher', ariaLabel: 'Plugin Sound Matcher', link: '/plugin-sound-matcher' }
  ];

  const socialItems = [
    { label: 'GitHub', link: 'https://github.com' },
    { label: 'LinkedIn', link: 'https://linkedin.com' }
  ];

  return (
    <div style={{ height: '100vh', background: '#1a1a1a' }}>
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
      <div className="container">
        <div className="flex justify-center my-5">
            <Image src="/logo.svg" alt="Knowaudio Logo" width={300} height={100} />
          </div>
        <p className="text-center">This is where the beat making feature will be.</p>
      </div>
    </div>
  );
}
