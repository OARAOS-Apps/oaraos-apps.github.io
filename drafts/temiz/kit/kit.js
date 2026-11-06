/* Oaraos ürün sitesi kiti — tema düğmesi, kayarak belirme (.rv), panel sayaçları.
   KAYNAK: RELEASE/products/kit/kit.js; ürün klasörlerindeki kit/ bir KOPYADIR.
   Kullanım: <script src="kit/kit.js" data-product="<ad>"></script> (body sonunda). */
(() => {
  const key = ((document.currentScript && document.currentScript.dataset.product) || "product") + "-theme";
  const root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem(key) } catch (e) { return null } })();
  if (saved) root.dataset.theme = saved;
  const themeBtn = document.getElementById("theme");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem(key, root.dataset.theme) } catch (e) {}
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".rv").forEach((el, i) => { el.style.transitionDelay = (i % 3) * 80 + "ms"; io.observe(el); });
  const dash = document.querySelector(".dash");
  if (!dash) return;
  const play = () => {
    dash.querySelectorAll("[data-w]").forEach(i => i.style.width = i.dataset.w + "%");
    dash.querySelectorAll("[data-h]").forEach(i => i.style.height = i.dataset.h + "%");
    if (reduce) return;
    dash.querySelectorAll("[data-n]").forEach(el => {
      const end = +el.dataset.n, suf = el.dataset.suf || "", pre = el.dataset.pre || "", t0 = performance.now();
      const tick = t => { const p = Math.min(1, (t - t0) / 1300); el.textContent = pre + Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString("tr-TR") + suf; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  };
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { play(); o.disconnect(); } }, { threshold: .3 }).observe(dash);
})();
