"use client";

import Image from "next/image";
import StaggeredMenu from "@/components/StaggeredMenu";
import { getMenuItemsForPage, SOCIAL_ITEMS } from "@/constants/navigation";

export default function BeatsPage() {
  // Menu items for navigation (excluding current page)
  const menuItems = getMenuItemsForPage('/beats');

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
        <div className="flex justify-center my-5">
            <Image src="/logo.svg" alt="Knowaudio Logo" width={300} height={100} />
          </div>
        <p className="text-center">This is where the beat making feature will be.</p>
      </div>
    </div>
  );
}
