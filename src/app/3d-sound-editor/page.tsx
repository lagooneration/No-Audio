import StaggeredMenu from "@/components/StaggeredMenu";

export default function ThreeDSoundEditorPage() {
  const menuItems = [
    { label: 'Analysis', ariaLabel: 'Audio Analysis', link: '/analysis' },
    { label: 'Beats', ariaLabel: 'Beat Generator', link: '/beats' },
    { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
    { label: 'Editing', ariaLabel: 'Audio Editing', link: '/editing' },
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
        <h1 className="text-center my-5">3D Sound Editor</h1>
        <p className="text-center">This is where the 3D sound editor feature will be. This will use three.js.</p>
      </div>
    </div>
  );
}
