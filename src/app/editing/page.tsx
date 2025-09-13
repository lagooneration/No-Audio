import StaggeredMenu from "@/components/StaggeredMenu";

export default function EditingPage() {
  const menuItems = [
    { label: 'Analysis', ariaLabel: 'Audio Analysis', link: '/analysis' },
    { label: 'Beats', ariaLabel: 'Beat Generator', link: '/beats' },
    { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
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
        <h1 className="text-center my-5">Audio Editing</h1>
        <p className="text-center">This is where the audio editing feature will be.</p>
      </div>
    </div>
  );
}
