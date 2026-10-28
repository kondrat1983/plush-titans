// Boot: turns the vector art into textures, then opens the first scene (or the one a rotation came from).
(window.PTScenes = window.PTScenes || []).push((PT) => class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    this.add.rectangle(PT.W / 2, PT.H / 2, PT.W, PT.H, PT.ui.C.sky1);
    const game = this.game;
    PTArt.load(this).then(() => {
      if (window.__game !== game) return; // the game was rebuilt (rotation) while the art was loading
      const r = PT.RESUME;
      const key = r && this.scene.manager.keys[r.key] ? r.key : 'title';
      this.scene.start(key, r && r.key === key ? r.data : {});
    });
  }
});
