// One-time generation of decorative rain/snow/cloud particles.
// Visibility of each layer is controlled purely by CSS via body[data-sky].

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function initSkyParticles() {
  const cloudLayer = document.getElementById('cloudLayer');
  const rainLayer = document.getElementById('rainLayer');
  const snowLayer = document.getElementById('snowLayer');

  if (cloudLayer && !cloudLayer.children.length) {
    [1, 2, 3].forEach((n) => {
      const el = document.createElement('div');
      el.className = `cloud cloud--${n}`;
      cloudLayer.appendChild(el);
    });
  }

  if (rainLayer && !rainLayer.children.length) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 60; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = `${rand(0, 100)}%`;
      drop.style.animationDuration = `${rand(0.5, 1.1).toFixed(2)}s`;
      drop.style.animationDelay = `${rand(0, 2).toFixed(2)}s`;
      drop.style.opacity = rand(0.3, 0.8).toFixed(2);
      frag.appendChild(drop);
    }
    rainLayer.appendChild(frag);
  }

  if (snowLayer && !snowLayer.children.length) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 45; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';
      const size = rand(2, 6);
      flake.style.left = `${rand(0, 100)}%`;
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.opacity = rand(0.5, 1).toFixed(2);
      flake.style.animationDuration = `${rand(7, 15).toFixed(1)}s, ${rand(3, 5).toFixed(1)}s`;
      flake.style.animationDelay = `${rand(0, 8).toFixed(1)}s`;
      frag.appendChild(flake);
    }
    snowLayer.appendChild(frag);
  }
}
