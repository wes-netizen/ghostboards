export type Option = {
  id: string;
  label: string;
  priceDelta: number;
  imageUrl?: string;
  // optional dimensions for deck shapes
  length?: number; // meters
  width?: number; // meters
  dropThrough?: boolean;
};

export const deckShapes: Option[] = [
  { id: '30_wheel_cut', label: '30" wheel cut', priceDelta: 0, imageUrl: '/options/deck-30-wheel-cut.svg', length: 0.76, width: 0.22 },
  { id: '36_surfer', label: '36" surfer', priceDelta: 10, imageUrl: '/options/deck-36-surfer.svg', length: 0.91, width: 0.24 },
  { id: '40_wheel_cut', label: '40" wheel cut', priceDelta: 20, imageUrl: '/options/deck-40-wheel-cut.svg', length: 1.02, width: 0.26 },
  { id: '40_platypus', label: '40" platypus', priceDelta: 20, imageUrl: '/options/deck-40-platypus.svg', length: 1.02, width: 0.27 },
  { id: '40_platypus_drop', label: '40" platypus (drop thru)', priceDelta: 25, imageUrl: '/options/deck-40-platypus-drop.svg', length: 1.02, width: 0.27, dropThrough: true },
  { id: '48_pintail', label: '48" pintail', priceDelta: 30, imageUrl: '/options/deck-48-pintail.svg', length: 1.22, width: 0.28 },
  { id: '48_dancer', label: '48" dancer', priceDelta: 35, imageUrl: '/options/deck-48-dancer.svg', length: 1.22, width: 0.30 }
];

export const deckThicknesses: Option[] = [
  { id: '3_4', label: '3/4"', priceDelta: 0 },
  { id: '1', label: '1"', priceDelta: 12 }
];

export const fullLedOption: Option[] = [
  { id: 'led_yes', label: 'Full LED deck', priceDelta: 65 },
  { id: 'led_no', label: 'No LEDs', priceDelta: 0 }
];

export const deckFinishes: Option[] = [
  { id: 'finish_clear', label: 'Clear Finish', priceDelta: 0 },
  { id: 'finish_color', label: 'Solid Color', priceDelta: 0 }
];

export const trucks: Option[] = [
  { id: 'truck_black_180', label: 'Black 180mm / 50°', priceDelta: 0, imageUrl: '/options/truck-black.svg' },
  { id: 'truck_white_180', label: 'White 180mm / 50°', priceDelta: 0, imageUrl: '/options/truck-white.svg' },
  { id: 'truck_silver_180', label: 'Silver 180mm / 50°', priceDelta: 6, imageUrl: '/options/truck-silver.svg' },
  { id: 'truck_gold_180', label: 'Gold 180mm / 50°', priceDelta: 12, imageUrl: '/options/truck-gold.svg' },
  { id: 'truck_blue_180', label: 'Blue 180mm / 50°', priceDelta: 6, imageUrl: '/options/truck-blue.svg' }
];

export const wheels: Option[] = [
  { id: 'wheel_white', label: 'White 70mm', priceDelta: 0, imageUrl: '/options/wheel-white.svg' },
  { id: 'wheel_black', label: 'Black 70mm', priceDelta: 0, imageUrl: '/options/wheel-black.svg' },
  { id: 'wheel_red', label: 'Red 70mm', priceDelta: 6, imageUrl: '/options/wheel-red.svg' },
  { id: 'wheel_translucent', label: 'Clear / Translucent 70mm', priceDelta: 8, imageUrl: '/options/wheel-clear.svg' }
];

export const rack: Option[] = [];
export const boardCare: Option[] = [];
export const ttools: Option[] = [];
export const bumpers: Option[] = [];
