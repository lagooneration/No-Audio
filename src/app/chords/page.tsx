"use client";

import StaggeredMenu from "@/components/StaggeredMenu";
import { getMenuItemsForPage, SOCIAL_ITEMS } from "@/constants/navigation";

export default function ChordsPage() {
  // Menu items for navigation (excluding current page)
  const menuItems = getMenuItemsForPage('/chords');

  return (
    <div style={{ height: '100vh', background: '#1a1a1a' }}>
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={SOCIAL_ITEMS}
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
        <h1 className="text-center my-5">Chords</h1>
        <p className="text-center">This is where the chord progression feature will be.</p>
      </div>
    </div>
  );
}
