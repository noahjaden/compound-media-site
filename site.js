(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  var vids = document.querySelectorAll('.work video[data-src]');
  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src) { v.src = v.getAttribute('data-src'); v.load(); }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else if (v.src) { v.pause(); }
    });
  }, { threshold: 0.35 });
  vids.forEach(function (v) { vio.observe(v); });

  document.querySelectorAll('.work').forEach(function (fig) {
    var v = fig.querySelector('video'); var btn = fig.querySelector('.play');
    if (!v || !btn) return;
    btn.addEventListener('click', function () {
      v.muted = !v.muted; btn.textContent = v.muted ? '▶' : '♪';
      if (v.paused) v.play();
    });
  });

  var hero = document.querySelector('.hero-media video');
  if (hero && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { hero.pause(); hero.removeAttribute('autoplay'); }
})();
