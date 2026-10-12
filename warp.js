/* Warp-sterrenveld: rustige vlucht door de ruimte op de achtergrond.
   Bij binnenkomst een korte sprong (hyperspace), daarna kruissnelheid.
   Scrollen geeft gas: hoe sneller je scrolt, hoe langer de strepen. */
(function () {
  var canvas = document.createElement('canvas');
  canvas.className = 'warp';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  var ctx = canvas.getContext('2d');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 900;
  var COUNT = mobile ? 260 : 560;
  var DEPTH = 1600, FOCAL = 520;
  var CRUISE = 1.6, JUMP = 70;

  var W, H, dpr, stars = [];
  var speed = reduce ? 0 : JUMP, boost = 0, lastY = window.scrollY;
  var vx = 0.5, vy = 0.42, tx = 0.5, ty = 0.42;   // vanishing point (fractie van scherm)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(s, anywhere) {
    s.x = (Math.random() - 0.5) * W * 2.2;
    s.y = (Math.random() - 0.5) * H * 2.2;
    s.z = anywhere ? Math.random() * DEPTH : DEPTH;
    s.pz = s.z;
    s.blue = Math.random() < 0.28;
    s.size = Math.random() < 0.08 ? 1.6 : 0.9;
    return s;
  }
  resize();
  for (var i = 0; i < COUNT; i++) stars.push(spawn({}, true));

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    boost = Math.min(boost + Math.abs(y - lastY) * 0.06, 34);
    lastY = y;
  }, { passive: true });
  if (!mobile) window.addEventListener('pointermove', function (e) {
    tx = 0.5 + (e.clientX / W - 0.5) * 0.08;
    ty = 0.42 + (e.clientY / H - 0.5) * 0.08;
  });

  function frame() {
    speed += (CRUISE - speed) * 0.035;          // sprong zakt uit naar kruissnelheid
    boost *= 0.92;
    vx += (tx - vx) * 0.04; vy += (ty - vy) * 0.04;
    var v = speed + boost;
    var cx = W * vx, cy = H * vy;
    // hoe sneller, hoe sterker de sporen blijven hangen
    ctx.fillStyle = 'rgba(8,9,11,' + (v > 8 ? 0.35 : 0.9) + ')';
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.pz = s.z;
      s.z -= v;
      if (s.z < 1) { spawn(s, false); continue; }
      var k = FOCAL / s.z, pk = FOCAL / s.pz;
      var x = cx + s.x * k, y = cy + s.y * k;
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) { spawn(s, false); continue; }
      var px = cx + s.x * pk, py = cy + s.y * pk;
      var a = Math.min(1, (1 - s.z / DEPTH) * 1.3);
      ctx.strokeStyle = s.blue ? 'rgba(120,160,255,' + a + ')' : 'rgba(235,240,255,' + a * 0.85 + ')';
      ctx.lineWidth = s.size * Math.min(2.4, 0.4 + k * 0.9);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
    }
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  var raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) raf = requestAnimationFrame(frame);
  });
})();
