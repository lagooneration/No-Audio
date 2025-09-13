// Navigation constants for StaggeredMenu
export interface NavigationItem {
  label: string;
  ariaLabel: string;
  link: string;
}

export interface SocialItem {
  label: string;
  link: string;
}

// All available navigation items
export const ALL_MENU_ITEMS: NavigationItem[] = [
  { label: 'Analysis', ariaLabel: 'Audio Analysis', link: '/analysis' },
  { label: 'Beats', ariaLabel: 'Beat Generator', link: '/beats' },
  { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
  { label: 'Editing', ariaLabel: 'Audio Editing', link: '/editing' },
  { label: '3D Sound', ariaLabel: '3D Sound Editor', link: '/3d-sound-editor' },
  { label: 'Plugin Matcher', ariaLabel: 'Plugin Sound Matcher', link: '/plugin-sound-matcher' }
];

// Social media links
export const SOCIAL_ITEMS: SocialItem[] = [
  { label: 'GitHub', link: 'https://github.com' },
  { label: 'LinkedIn', link: 'https://linkedin.com' }
];

// StaggeredMenu configuration
export const MENU_CONFIG = {
  position: 'right' as const,
  displaySocials: true,
  displayItemNumbering: true,
  menuButtonColor: '#fff',
  openMenuButtonColor: '#000',
  changeMenuColorOnOpen: true,
  colors: ['#B19EEF', '#5227FF'],
  logoUrl: '/logo.svg',
  accentColor: '#ff6b6b'
};

// Helper function to get menu items excluding current page
export const getMenuItemsForPage = (currentPath: string): NavigationItem[] => {
  return ALL_MENU_ITEMS.filter(item => item.link !== currentPath);
};