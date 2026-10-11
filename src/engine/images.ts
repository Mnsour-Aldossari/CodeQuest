/**
 * The only images player code may use. They are inlined as data: URIs when the
 * program runs, so the sandbox never needs network or same-origin access.
 */
const svg = (body: string, vb = '0 0 120 100') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="160">${body}</svg>`)}`;

export const GAME_IMAGE_DATA: Record<string, string> = {
  'house.svg': svg(
    '<rect x="0" y="88" width="120" height="12" fill="#EDD3A8"/><rect x="22" y="44" width="76" height="46" fill="#E3A274" stroke="#7A2E1F" stroke-width="3"/><path d="M14 46 L60 12 L106 46Z" fill="#C24E2B" stroke="#7A2E1F" stroke-width="3" stroke-linejoin="round"/><rect x="52" y="62" width="16" height="28" rx="3" fill="#7A2E1F"/><rect x="30" y="54" width="14" height="12" rx="2" fill="#FFD27A"/><rect x="76" y="54" width="14" height="12" rx="2" fill="#FFD27A"/>',
  ),
  'bit.svg': svg(
    '<rect x="30" y="64" width="60" height="32" rx="14" fill="#E4DEFF" stroke="#1F1A2E" stroke-width="3"/><rect x="18" y="12" width="84" height="56" rx="24" fill="#F7F5FF" stroke="#1F1A2E" stroke-width="3"/><rect x="28" y="22" width="64" height="36" rx="15" fill="#1F1A2E"/><rect x="42" y="30" width="10" height="15" rx="5" fill="#5CF2E8"/><rect x="68" y="30" width="10" height="15" rx="5" fill="#5CF2E8"/><path d="M52 50 Q60 56 68 50" fill="none" stroke="#5CF2E8" stroke-width="3" stroke-linecap="round"/>',
  ),
  'tree.svg': svg('<rect x="54" y="70" width="12" height="26" fill="#7A4A2A"/><path d="M60 6 L94 52 H74 L100 80 H20 L46 52 H26Z" fill="#1A7F53"/>'),
  'flower.svg': svg('<rect x="58" y="50" width="4" height="46" fill="#1A7F53"/><circle cx="60" cy="40" r="26" fill="#D6457F"/><circle cx="60" cy="40" r="10" fill="#FFD25A"/>'),
  'gem.svg': svg('<path d="M30 36 L46 16 H74 L90 36 L60 86Z" fill="#3FE0E8" stroke="#0A7AA0" stroke-width="3" stroke-linejoin="round"/><path d="M30 36 H90 M46 16 L60 36 L74 16 M60 36 V86" stroke="#0A7AA0" stroke-width="2" fill="none"/>'),
  'castle.svg': svg('<rect x="20" y="40" width="80" height="56" fill="#2B2370"/><rect x="14" y="20" width="22" height="76" fill="#221B52"/><rect x="84" y="20" width="22" height="76" fill="#221B52"/><path d="M14 20 L25 4 L36 20Z M84 20 L95 4 L106 20Z" fill="#6A3FD6"/><rect x="50" y="64" width="20" height="32" rx="10" fill="#FFB547"/>'),
};
