// Plush Titans art: simple vector pictures made in code (no image files, no licences to track).
// Shapes come from the approved battle mock-up (mockup/battle.html). load(scene) turns them into Phaser textures.
(function (root) {
  'use strict';

  const INK = '#3a2c5c';

  function eyes(y) {
    return '<circle cx="80" cy="' + y + '" r="7" fill="' + INK + '"/><circle cx="120" cy="' + y + '" r="7" fill="' + INK + '"/>' +
      '<circle cx="82" cy="' + (y - 2) + '" r="2.5" fill="#fff"/><circle cx="122" cy="' + (y - 2) + '" r="2.5" fill="#fff"/>';
  }

  // A giant pillow with tassels, chubby arms and a happy face. Colours vary per Titan.
  function titan(col, dark) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 190">' +
      '<path d="M30 40 Q100 10 170 40 Q190 100 170 160 Q100 185 30 160 Q10 100 30 40Z" fill="' + col + '" stroke="' + dark + '" stroke-width="5"/>' +
      '<path d="M60 60 Q100 48 140 60" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>' +
      [[30, 40], [170, 40], [30, 160], [170, 160]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + dark + '"/>').join('') +
      '<ellipse cx="22" cy="110" rx="14" ry="20" fill="' + col + '" stroke="' + dark + '" stroke-width="5"/>' +
      '<ellipse cx="178" cy="110" rx="14" ry="20" fill="' + col + '" stroke="' + dark + '" stroke-width="5"/>' +
      eyes(95) +
      '<circle cx="66" cy="115" r="9" fill="#ff9fb8" opacity=".6"/><circle cx="134" cy="115" r="9" fill="#ff9fb8" opacity=".6"/>' +
      '<path d="M86 120 q14 12 28 0" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/></svg>';
  }

  // Professor Hoot, giant: an owl with glasses and a graduation cap.
  const HOOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<ellipse cx="100" cy="120" rx="72" ry="72" fill="#b48a62" stroke="#7d5a3c" stroke-width="5"/>' +
    '<ellipse cx="100" cy="140" rx="44" ry="46" fill="#f1dcc0"/>' +
    '<path d="M100 150 l-6 0 m6 -10 l-6 0 m22 10 l-6 0 m6 -10 l-6 0" stroke="#d1b28e" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="72" cy="98" r="22" fill="#fff" stroke="' + INK + '" stroke-width="5"/><circle cx="128" cy="98" r="22" fill="#fff" stroke="' + INK + '" stroke-width="5"/>' +
    '<path d="M94 98 h12" stroke="' + INK + '" stroke-width="5"/>' +
    '<circle cx="74" cy="100" r="8" fill="' + INK + '"/><circle cx="126" cy="100" r="8" fill="' + INK + '"/>' +
    '<path d="M92 112 l8 12 l8 -12z" fill="#ffb03a"/>' +
    '<path d="M40 52 L100 30 L160 52 L100 72Z" fill="' + INK + '"/><rect x="78" y="56" width="44" height="16" fill="' + INK + '"/>' +
    '<path d="M156 52 v26" stroke="#ffc83d" stroke-width="4"/><circle cx="156" cy="80" r="5" fill="#ffc83d"/></svg>';

  const hero = (body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' + body + '</svg>';
  const HEROES = {
    fluffy: hero('<circle cx="24" cy="26" r="18" fill="#fff" stroke="#c9b8ef" stroke-width="3"/><circle cx="18" cy="24" r="2.6" fill="' + INK + '"/><circle cx="30" cy="24" r="2.6" fill="' + INK + '"/><path d="M20 31q4 3 8 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    bear: hero('<circle cx="12" cy="12" r="7" fill="#b5835a"/><circle cx="36" cy="12" r="7" fill="#b5835a"/><circle cx="24" cy="26" r="17" fill="#c99467"/><ellipse cx="24" cy="31" rx="8" ry="6" fill="#f0d6b8"/><circle cx="18" cy="22" r="2.6" fill="' + INK + '"/><circle cx="30" cy="22" r="2.6" fill="' + INK + '"/><circle cx="24" cy="29" r="2.4" fill="' + INK + '"/>'),
    bunny: hero('<ellipse cx="17" cy="11" rx="5" ry="11" fill="#f3f0f7" stroke="#e0b8cf" stroke-width="2"/><ellipse cx="31" cy="11" rx="5" ry="11" fill="#f3f0f7" stroke="#e0b8cf" stroke-width="2"/><circle cx="24" cy="29" r="15" fill="#f3f0f7" stroke="#e0b8cf" stroke-width="2"/><circle cx="19" cy="27" r="2.4" fill="' + INK + '"/><circle cx="29" cy="27" r="2.4" fill="' + INK + '"/><circle cx="24" cy="32" r="2" fill="#ff8fb3"/>'),
    dino: hero('<path d="M10 14l4-6 4 6 4-7 4 7 4-6 4 6" fill="#6fcf7f"/><ellipse cx="24" cy="28" rx="18" ry="15" fill="#8ee09a" stroke="#4fae60" stroke-width="2"/><circle cx="17" cy="25" r="2.6" fill="' + INK + '"/><circle cx="31" cy="25" r="2.6" fill="' + INK + '"/><path d="M17 33q7 4 14 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  };

  const SMALL = {
    pillow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 32"><path d="M4 6Q22 0 40 6Q44 16 40 26Q22 32 4 26Q0 16 4 6Z" fill="#fff" stroke="#c9b8ef" stroke-width="2.5"/></svg>',
    feather: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 14C4 6 9 2 14 2C13 8 8 12 2 14Z" fill="#fff" stroke="#c9b8ef" stroke-width="1.2"/></svg>',
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z" fill="#ffc83d" stroke="#c98f00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    moon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 3a9 9 0 1 0 7 14A8 8 0 0 1 14 3z" fill="#ffc83d"/><circle cx="18" cy="6" r="1.2" fill="#fff"/><circle cx="21" cy="10" r=".8" fill="#fff"/></svg>',
    cloud: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><g fill="#fff"><ellipse cx="60" cy="44" rx="58" ry="16"/><circle cx="44" cy="30" r="22"/><circle cx="74" cy="26" r="18"/></g></svg>',
    // white at the bottom, clear at the top; tinted to the page colour for the iOS 26 strip
    fadeB: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 64" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="8" height="64" fill="url(#g)"/></svg>',
  };

  // Titan looks by id (string keys). Order of appearance is a separate list in the game data.
  const TITANS = {
    snoozy: { col: '#ffd1e3', dark: '#f59cc0' },
    fluff: { col: '#cfe7ff', dark: '#8ec1f2' },
    cushion: { col: '#ffe7a8', dark: '#f2c45a' },
    lumpy: { col: '#d9f5d0', dark: '#9fd68f' },
  };

  // [key, svg, width px, height px]: rendered at this size, scaled in the scene
  function all() {
    const list = [];
    for (const id of Object.keys(TITANS)) list.push(['titan_' + id, titan(TITANS[id].col, TITANS[id].dark), 640, 608]);
    list.push(['hoot', HOOT, 640, 640]);
    for (const id of Object.keys(HEROES)) list.push(['hero_' + id, HEROES[id], 192, 192]);
    list.push(['pillow', SMALL.pillow, 132, 96], ['feather', SMALL.feather, 48, 48], ['star', SMALL.star, 96, 96],
      ['moon', SMALL.moon, 128, 128], ['cloud', SMALL.cloud, 360, 180], ['fadeB', SMALL.fadeB, 8, 64]);
    return list;
  }

  function sized(svg, w, h) {
    return svg.replace('<svg ', '<svg width="' + w + '" height="' + h + '" ');
  }

  // Adds every picture as a texture. Resolves when all are ready (a failed one is skipped, never blocks the game).
  function load(scene) {
    const tex = scene.textures;
    return Promise.all(all().map(([key, svg, w, h]) => new Promise((done) => {
      if (tex.exists(key)) return done();
      const img = new Image();
      img.onload = () => { try { tex.addImage(key, img); } catch (e) {} done(); };
      img.onerror = () => done();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized(svg, w, h));
    })));
  }

  const api = { TITANS, HEROES, titan, HOOT, SMALL, all, load };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PTArt = api;
})(typeof self !== 'undefined' ? self : this);
