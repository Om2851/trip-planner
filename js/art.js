// Hand-drawn SVG scenes used as trip covers and page art.
// Original artwork (no external images), so it's free to use, tiny and works offline.

let n = 0;
const W = 400, H = 200;

const SCENES = {
  beach: { label: '🏖️ Beach', sky: ['#ffe3c4', '#ffb59a', '#ff8f87'] },
  mountains: { label: '🏔️ Mountains', sky: ['#cfe8f5', '#e9eef4', '#f7dccb'] },
  city: { label: '🏙️ City', sky: ['#2c2f63', '#7a4f8a', '#f29a7e'] },
  forest: { label: '🌲 Forest', sky: ['#e3f4e6', '#cfeadb', '#fdebc8'] },
  desert: { label: '🏜️ Desert', sky: ['#ffeccc', '#ffc993', '#f59a6a'] },
  sunset: { label: '🌅 Sunset', sky: ['#ffd8b1', '#ff9f8a', '#c17ea8'] },
};
export const SCENE_KEYS = Object.keys(SCENES);
export const sceneLabel = (k) => (SCENES[k] || SCENES.sunset).label;

const KW = {
  beach: ['goa', 'bali', 'beach', 'kerala', 'kovalam', 'varkala', 'gokarna', 'andaman', 'havelock', 'pondicherry', 'puducherry', 'phuket', 'krabi', 'maldives', 'mauritius', 'lakshadweep', 'alibaug', 'diu', 'hawaii', 'cancun', 'ibiza', 'santorini', 'mykonos', 'goa,'],
  mountains: ['manali', 'ladakh', 'leh', 'shimla', 'himalaya', 'spiti', 'kasol', 'mcleod', 'dharamshala', 'alps', 'nepal', 'kathmandu', 'pokhara', 'kashmir', 'gulmarg', 'darjeeling', 'gangtok', 'sikkim', 'rishikesh', 'mussoorie', 'nainital', 'auli', 'swiss', 'switzerland', 'interlaken', 'zermatt', 'banff', 'patagonia', 'tawang', 'ooty', 'munnar'],
  desert: ['jaipur', 'jaisalmer', 'jodhpur', 'udaipur', 'rajasthan', 'pushkar', 'bikaner', 'dubai', 'abu dhabi', 'sahara', 'marrakech', 'morocco', 'kutch', 'rann', 'egypt', 'cairo', 'arizona', 'wadi rum', 'petra'],
  city: ['mumbai', 'delhi', 'bengaluru', 'bangalore', 'kolkata', 'chennai', 'hyderabad', 'pune', 'paris', 'london', 'tokyo', 'new york', 'singapore', 'dublin', 'hong kong', 'seoul', 'berlin', 'amsterdam', 'barcelona', 'rome', 'bangkok', 'istanbul', 'sydney', 'prague', 'vienna'],
  forest: ['coorg', 'wayanad', 'meghalaya', 'shillong', 'cherrapunji', 'chikmagalur', 'sakleshpur', 'jim corbett', 'corbett', 'kanha', 'ranthambore', 'amazon', 'black forest', 'lonavala', 'mahabaleshwar', 'matheran', 'dandeli', 'sundarbans'],
};

export function sceneFor(trip) {
  if (!trip) return 'sunset';
  if (trip.theme && SCENES[trip.theme]) return trip.theme;
  const name = ((trip.destination && trip.destination.name) || '') + ' ' + (trip.name || '');
  const s = name.toLowerCase();
  for (const k of ['beach', 'mountains', 'desert', 'forest', 'city']) if (KW[k].some((w) => s.includes(w))) return k;
  const v = trip.vibes || [];
  if (v.includes('beach')) return 'beach';
  if (v.includes('mountains') || v.includes('trek')) return 'mountains';
  if (v.includes('camping')) return 'forest';
  if (v.includes('city') || v.includes('nightlife')) return 'city';
  return 'sunset';
}

const grad = (id, stops, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map((c, i) => `<stop offset="${Math.round(i / (stops.length - 1) * 100)}%" stop-color="${c}"/>`).join('')}</linearGradient>`;
const cloud = (x, y, s, o = 0.75) => `<g fill="#fff" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="9"/><ellipse cx="14" cy="-6" rx="14" ry="10"/><ellipse cx="-12" cy="-4" rx="11" ry="8"/></g>`;
const birds = (x, y, c = '#5b4a5e') => `<g fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round" opacity=".6"><path d="M${x} ${y} q4 -4 8 0 q4 -4 8 0"/><path d="M${x + 22} ${y - 9} q3 -3 6 0 q3 -3 6 0"/><path d="M${x + 12} ${y + 8} q3 -3 6 0 q3 -3 6 0"/></g>`;
const sun = (id, x, y, r, c1, c2) => `<radialGradient id="${id}g"><stop offset="0%" stop-color="${c1}" stop-opacity=".9"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient><circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="url(#${id}g)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c2}"/>`;

function beach(id) {
  return `<defs>${grad(id + 's', SCENES.beach.sky)}${grad(id + 'w', ['#6cc3bd', '#2f8f95', '#1f6f7a'])}${grad(id + 'd', ['#f8e2b8', '#eccb92'])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${sun(id, 270, 104, 26, '#fff4d6', '#fff2cf')}
  ${cloud(80, 46, 1.1)}${cloud(330, 30, 0.8, 0.6)}${cloud(200, 60, 0.6, 0.5)}${birds(150, 54)}
  <path d="M0 118 H${W} V${H} H0Z" fill="url(#${id}w)"/>
  <g stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M235 126 h70"/><path d="M250 134 h40"/><path d="M40 132 q12 -4 24 0 t24 0"/><path d="M150 142 q12 -4 24 0 t24 0"/><path d="M300 150 q12 -4 24 0 t24 0"/></g>
  <path d="M0 160 C90 146 170 150 240 162 S360 176 ${W} 166 V${H} H0Z" fill="url(#${id}d)"/>
  <path d="M0 160 C90 146 170 150 240 162 S360 176 ${W} 166" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
  <g transform="translate(58 176)"><path d="M0 0 C4 -30 10 -58 26 -82" stroke="#7a5236" stroke-width="5" fill="none" stroke-linecap="round"/>
  <g fill="#2f7a5c"><path d="M26 -82 c-18 -10 -38 -6 -48 6 c16 -8 32 -6 48 -6z"/><path d="M26 -82 c-6 -18 -24 -26 -38 -24 c14 4 28 12 38 24z"/><path d="M26 -82 c10 -16 30 -20 44 -14 c-16 0 -32 6 -44 14z"/><path d="M26 -82 c18 -4 36 6 42 20 c-12 -10 -28 -16 -42 -20z"/><path d="M26 -82 c4 -18 16 -30 30 -32 c-10 8 -22 20 -30 32z"/></g></g>
  <g transform="translate(330 180)"><path d="M-14 0 a14 7 0 0 1 28 0z" fill="#ff7a59"/><path d="M0 -26 v26" stroke="#7a5236" stroke-width="2"/><path d="M-22 -24 q22 -18 44 0z" fill="#ff7a59"/><path d="M-22 -24 q11 -6 22 0 q11 -6 22 0" fill="#fff" opacity=".55"/></g>`;
}
function mountains(id) {
  return `<defs>${grad(id + 's', SCENES.mountains.sky)}${grad(id + 'l', ['#8fbccf', '#5a8ea3'])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${sun(id, 300, 58, 18, '#fff1d9', '#fff6e6')}
  ${cloud(90, 40, 1)}${cloud(250, 30, 0.7, 0.6)}${birds(170, 50, '#4b5b6b')}
  <path d="M0 130 L60 80 L110 112 L170 58 L230 110 L290 70 L350 104 L${W} 84 V${H} H0Z" fill="#a9c3d3"/>
  <path d="M170 58 L186 74 L176 72 L168 80 L160 72 L154 74Z M290 70 L303 83 L294 81 L287 88 L281 81 L276 84Z" fill="#fff" opacity=".9"/>
  <path d="M0 150 L50 112 L100 140 L160 96 L220 142 L280 104 L340 138 L${W} 116 V${H} H0Z" fill="#7d9fb2"/>
  <path d="M160 96 L176 110 L166 108 L158 116 L150 108 L144 110Z M280 104 L292 115 L284 113 L278 120 L272 113 L267 116Z" fill="#fff" opacity=".85"/>
  <path d="M0 172 C80 160 140 166 210 172 S330 178 ${W} 168 V${H} H0Z" fill="url(#${id}l)"/>
  <g stroke="#fff" stroke-opacity=".5" stroke-width="1.4"><path d="M60 182 h40"/><path d="M240 186 h60"/></g>
  <g fill="#2f5560">${[[20, 168, 1], [36, 172, 0.8], [330, 166, 1.1], [350, 170, 0.8], [368, 166, 0.95]].map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -34 L10 -16 L5 -16 L13 -4 L6 -4 L14 8 L-14 8 L-6 -4 L-13 -4 L-5 -16 L-10 -16Z"/>`).join('')}</g>`;
}
function city(id) {
  const bld = [[0, 120, 34], [30, 96, 26], [52, 132, 30], [78, 84, 22], [96, 110, 34], [126, 70, 20], [142, 100, 30], [168, 124, 26], [190, 90, 24], [210, 116, 36], [242, 76, 22], [260, 104, 30], [286, 128, 26], [308, 92, 28], [332, 112, 30], [358, 80, 22], [376, 118, 30]];
  let win = '';
  bld.forEach(([x, y, w], i) => { for (let yy = y + 8; yy < 190; yy += 11) for (let xx = x + 5; xx < x + w - 5; xx += 7) if ((xx * 7 + yy * 3 + i) % 5 < 2) win += `<rect x="${xx}" y="${yy}" width="3" height="5" rx=".5"/>`; });
  return `<defs>${grad(id + 's', SCENES.city.sky)}${grad(id + 'r', ['#3a3f78', '#232650'])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>
  <g fill="#fff">${[[30, 20], [80, 40], [140, 16], [220, 30], [300, 18], [360, 44], [190, 52], [110, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" opacity=".8"/>`).join('')}</g>
  <circle cx="320" cy="54" r="16" fill="#fff3d9"/><circle cx="327" cy="49" r="14" fill="#5a477e" opacity=".55"/>
  <path d="M0 150 L40 140 L80 148 L130 132 L190 146 L250 128 L310 144 L360 134 L${W} 142 V${H} H0Z" fill="#6b4e86" opacity=".6"/>
  <g fill="url(#${id}r)">${bld.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${H - y}" rx="2"/>`).join('')}<path d="M126 70 L136 52 L146 70Z"/><rect x="134" y="40" width="3" height="14"/></g>
  <g fill="#ffd27a" opacity=".85">${win}</g>
  <rect y="188" width="${W}" height="12" fill="#1b1d3d"/>`;
}
function forest(id) {
  const tree = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><path d="M0 -60 L16 -30 L8 -30 L22 -6 L10 -6 L26 18 L-26 18 L-10 -6 L-22 -6 L-8 -30 L-16 -30Z"/><rect x="-3" y="18" width="6" height="10" fill="#6b4a33"/></g>`;
  return `<defs>${grad(id + 's', SCENES.forest.sky)}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${sun(id, 90, 60, 20, '#fff4d6', '#fff8e6')}
  ${cloud(220, 40, 1)}${cloud(340, 56, 0.7, 0.6)}${birds(250, 70, '#4e6b58')}
  <path d="M0 120 C70 96 140 110 200 120 S330 96 ${W} 112 V${H} H0Z" fill="#a8d5b5"/>
  <path d="M0 146 C80 128 150 140 220 148 S340 130 ${W} 140 V${H} H0Z" fill="#7dbb91"/>
  ${[[30, 150, 0.8], [62, 156, 1], [300, 146, 0.9], [330, 154, 1.1], [362, 148, 0.85]].map(([x, y, s]) => tree(x, y, s, '#3f8a62')).join('')}
  <path d="M0 176 C90 166 160 172 240 178 S350 172 ${W} 170 V${H} H0Z" fill="#4f9a6f"/>
  ${[[110, 176, 1.1], [150, 182, 0.9], [210, 180, 1.2], [250, 186, 0.8]].map(([x, y, s]) => tree(x, y, s, '#2e6e4c')).join('')}
  <path d="M180 200 C190 186 200 182 214 176" stroke="#e9d9b6" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>`;
}
function desert(id) {
  const cactus = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#4f8a6a"><rect x="-5" y="-44" width="10" height="44" rx="5"/><path d="M-5 -24 h-8 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 8 0 v8 h4z"/><path d="M5 -30 h8 a4 4 0 0 0 4 -4 v-10 a4 4 0 0 0 -8 0 v6 h-4z"/></g>`;
  return `<defs>${grad(id + 's', SCENES.desert.sky)}${grad(id + 'a', ['#f4c28a', '#e5a565'])}${grad(id + 'b', ['#e8a86c', '#cf8a52'])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${sun(id, 210, 92, 34, '#fff1d0', '#fff0c9')}
  ${cloud(70, 40, 0.9, 0.55)}${cloud(330, 34, 0.8, 0.5)}${birds(120, 60, '#8a5a3c')}
  <path d="M0 138 C60 120 120 128 180 140 S300 120 ${W} 132 V${H} H0Z" fill="url(#${id}a)"/>
  <path d="M0 168 C80 146 170 156 240 170 S350 158 ${W} 162 V${H} H0Z" fill="url(#${id}b)"/>
  <path d="M40 160 C90 150 130 152 170 162" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
  ${cactus(70, 170, 1)}${cactus(340, 178, 0.8)}
  <g transform="translate(270 150)" fill="#7a4e33" opacity=".75"><path d="M0 0 c4 -6 10 -6 12 -2 l4 -6 c2 -2 4 0 3 2 l-3 6 c4 0 8 4 8 8 h-3 v6 h-2 v-6 h-10 v6 h-2 v-6 h-3 c-2 -4 -2 -6 -4 -8z"/></g>`;
}
function sunset(id) {
  return `<defs>${grad(id + 's', SCENES.sunset.sky)}${grad(id + 'h1', ['#f0a58f', '#d9878e'])}${grad(id + 'h2', ['#9a7aa8', '#6f5d93'])}${grad(id + 'h3', ['#3f6f7c', '#2b5664'])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${sun(id, 200, 112, 30, '#fff1d6', '#fff4dc')}
  ${cloud(70, 44, 1.1, 0.6)}${cloud(320, 36, 0.9, 0.5)}${birds(250, 58)}
  <path d="M0 130 C60 110 120 118 180 130 S300 108 ${W} 124 V${H} H0Z" fill="url(#${id}h1)"/>
  <path d="M0 154 C80 136 150 146 220 156 S340 138 ${W} 150 V${H} H0Z" fill="url(#${id}h2)"/>
  <path d="M0 178 C90 164 170 170 250 180 S350 172 ${W} 172 V${H} H0Z" fill="url(#${id}h3)"/>
  <path d="M120 200 C150 186 180 182 210 178 S260 174 290 170" stroke="#fbe3c8" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" fill="none" opacity=".8"/>`;
}
const DRAW = { beach, mountains, city, forest, desert, sunset };

export function sceneSvg(kind, cls = '') {
  const id = 'sc' + (++n) + (kind || 'x').slice(0, 2);
  const f = DRAW[kind] || sunset;
  return `<svg class="scene ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${f(id)}</svg>`;
}

// Cover for a trip: the user's photo if set, otherwise the illustrated scene.
export function coverHtml(trip, cls = '') {
  if (trip && trip.cover) return `<div class="cover-img ${cls}" style="background-image:url('${trip.cover.replace(/'/g, '')}')"></div>`;
  return sceneSvg(sceneFor(trip), cls);
}

// Resize an uploaded photo in the browser so it fits comfortably in Firestore.
export function compressImage(file, maxW = 1200, maxH = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const w = Math.min(maxW, img.width); const scale = w / img.width;
      const h = Math.round(Math.min(maxH, img.height * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const srcH = h / scale; const sy = (img.height - srcH) / 2; // centre crop
      c.getContext('2d').drawImage(img, 0, sy, img.width, srcH, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = 0.78, out = c.toDataURL('image/jpeg', q);
      while (out.length > 280000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}
