// Title: logo, a bobbing Titan, PLAY, + TOY, PARENTS, version label bottom-left.
(window.PTScenes = window.PTScenes || []).push((PT) => class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    const { W, H, PORTRAIT, ui } = PT;
    ui.scenery(this);
    // portrait: one column; landscape: the Titan on the left, logo and buttons on the right
    const colX = PORTRAIT ? W / 2 : W * 0.68, colW = PORTRAIT ? W - 160 : W * 0.5;
    const titanX = PORTRAIT ? W / 2 : W * 0.27, titanY = PORTRAIT ? H * 0.43 : H * 0.55;
    const titanS = (PORTRAIT ? Math.min(W * 0.62, H * 0.3) : Math.min(W * 0.36, H * 0.62)) / 640;

    this.add.ellipse(titanX, titanY + 300 * titanS * 1.05, 420 * titanS * 1.4, 50 * titanS * 1.4, PT.ui.C.inkN, 0.15);
    this.titan = this.add.image(titanX, titanY, 'titan_snoozy').setScale(titanS);
    this.tweens.add({ targets: this.titan, y: titanY - 24, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const logoY = PORTRAIT ? H * 0.13 : H * 0.2;
    ui.fit(ui.txt(this, colX, logoY - 70, 'PLUSH', 120, '#fff', { stroke: PT.ui.C.ink, shadow: true }), colW);
    ui.fit(ui.txt(this, colX, logoY + 60, 'TITANS', 150, '#ffc83d', { stroke: PT.ui.C.ink, shadow: true }), colW);

    const playY = PORTRAIT ? H * 0.7 : H * 0.55;
    const bw = PORTRAIT ? W - 200 : Math.min(colW, 760);
    this.play = ui.button(this, colX, playY, bw, 170, 'PLAY', () => this.go(), { size: 84 });
    const rowY = playY + (PORTRAIT ? 220 : 200), half = (bw - 30) / 2;
    ui.button(this, colX - half / 2 - 15, rowY, half, 140, '+ TOY', () => ui.toast(this, 'Toy photos come in a later update.'), { color: PT.ui.C.card, size: 56 });
    ui.button(this, colX + half / 2 + 15, rowY, half, 140, 'PARENTS', () => ui.toast(this, 'Parents area comes in a later update.'), { color: PT.ui.C.card, size: 50 });
    ui.versionLabel(this);
  }
  go() {
    if (this.scene.manager.keys.battle) PT.ui.fade(this, 'battle');
    else PT.ui.toast(this, 'The battle is being built. Come back soon!');
  }
});
