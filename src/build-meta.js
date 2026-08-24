(function(root){
  const meta={
    buildId:'2026.08.25-visual-evolution',
    cacheVersion:'wave-arena-v8-visual-evolution-20260825',
    precache:[
      './',
      './index.html',
      './src/build-meta.js',
      './src/game/runtime.js',
      './src/game/config.js',
      './src/game/render.js',
      './src/game.js',
      './src/game/ui.js',
      './src/platform/pwa.js',
      './studio-ident.js',
      './manifest.webmanifest',
      './icon.ico',
      './icon-192.png',
      './icon-512.png',
      './icon-maskable-512.png',
      './icon-apple-180.png',
      './assets/audio/ui-click.ogg',
      './assets/audio/ui-confirm.ogg',
      './assets/audio/ui-warning.ogg',
      './assets/audio/ui-reward.ogg',
      './assets/audio/impact-light.ogg',
      './assets/audio/impact-heavy.ogg'
    ]
  };
  Object.freeze(meta.precache);
  root.WA_BUILD_META=Object.freeze(meta);
  if(root.document){
    const tag=root.document.querySelector('meta[name="wa-build"]');
    if(tag) tag.setAttribute('content',meta.buildId);
  }
})(globalThis);
