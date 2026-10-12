(function () {
  var pin = document.querySelector('.hero-pin'), stage = document.querySelector('.hero-stage');
  var video = document.getElementById('hero-video'), still = document.querySelector('.hero-fallback');
  if (!pin || !stage || !video) return;
  var CFG = window.HERO_CFG = Object.assign({ scrollPerSecond: 520, parallax: 14, scale: 1.06, smooth: 14 }, window.HERO_CFG || {});
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 900;
  var copy = pin.querySelector('.hero-copy'), header = document.querySelector('header.site'), hint = pin.querySelector('.hero-hint');
  var DUR = parseFloat(video.getAttribute('data-duration')) || 6;
  var ready = false, target = 0, cur = 0, lastSeek = -1, mouse = { x: 0, y: 0 }, mouseT = { x: 0, y: 0 };

  if (reduce) { if (still) still.src = still.getAttribute('data-end') || still.src; video.remove(); pin.style.height = ''; return; }

  video.src = mobile ? video.getAttribute('data-src-mobile') : video.getAttribute('data-src');
  video.addEventListener('loadedmetadata', function () { DUR = video.duration || DUR; sizePin(); });
  video.addEventListener('canplaythrough', function () { if (ready) return; ready = true; video.classList.add('ready'); }, { once: true });
  video.load();

  function sizePin() { pin.style.height = Math.round(window.innerHeight + CFG.scrollPerSecond * DUR) + 'px'; }
  function progress() { var r = pin.getBoundingClientRect(), total = pin.offsetHeight - window.innerHeight; return total <= 0 ? 0 : Math.max(0, Math.min(1, -r.top / total)); }
  function onScroll() {
    target = progress();
    var r = pin.getBoundingClientRect(); if (header) header.classList.toggle('on-dark', r.bottom > 72);
    if (copy) { copy.style.opacity = String(Math.max(0, 1 - target * 2.2)); copy.style.transform = 'translateY(' + (-target * 60) + 'px)'; copy.style.pointerEvents = target > 0.4 ? 'none' : ''; }
    if (hint) hint.style.opacity = String(Math.max(0, 1 - target * 5));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { sizePin(); onScroll(); });
  window.addEventListener('pointermove', function (e) { mouseT.x = (e.clientX / window.innerWidth - 0.5) * 2; mouseT.y = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });

  var t0 = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    var el = Math.max(0, (now - t0) / 1000); t0 = now;
    var fs = 1 - Math.exp(-el * CFG.smooth), fm = 1 - Math.exp(-el * 5);
    cur += (target - cur) * fs; if (Math.abs(target - cur) < 0.0004) cur = target;
    mouse.x += (mouseT.x - mouse.x) * fm; mouse.y += (mouseT.y - mouse.y) * fm;
    if (pin.getBoundingClientRect().bottom <= 0) return;
    if (ready && video.readyState >= 2 && !video.seeking) {
      var t = Math.min(DUR - 0.02, cur * DUR);
      if (Math.abs(t - lastSeek) > 1 / 60) { video.currentTime = t; lastSeek = t; }
    }
    // parallax: the whole scene (video + still) tilts with the cursor; slight scroll push-in
    var sc = CFG.scale + cur * 0.04, tx = -mouse.x * CFG.parallax, ty = -mouse.y * CFG.parallax * 0.6;
    var tf = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
    video.style.transform = tf; if (still) still.style.transform = tf;
  }
  sizePin(); onScroll(); requestAnimationFrame(loop);
})();
