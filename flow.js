/* "Zo werkt het": mockups spelen af zodra de rij in beeld komt.
   Typt de zoekterm, laat advertentie, pagina en aanvragen na elkaar binnenkomen. */
(function () {
  var flow = document.querySelector('.flow');
  if (!flow) return;
  var typed = flow.querySelector('.typed');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function type(el, text, done) {
    var i = 0;
    (function tick() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, 70 + Math.random() * 60);
      else if (done) done();
    })();
  }
  function play() {
    if (flow.classList.contains('on')) return;
    if (reduce) { if (typed) typed.textContent = typed.dataset.text; flow.classList.add('on', 'typed-done'); return; }
    flow.classList.add('on');
    if (typed) type(typed, typed.dataset.text, function () { flow.classList.add('typed-done'); });
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { play(); io.disconnect(); } });
  }, { threshold: 0.3 });
  io.observe(flow);
})();
