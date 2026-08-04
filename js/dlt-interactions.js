/* ============================================================
   DLT INTERACTIONS — comportamentos padrão de artigo/guia/portal.
   Arquivo externo (o CSP do site não permite JS inline).
   Carregar no fim do <body>:  <script src="/js/dlt-interactions.js"></script>
   Nada aqui depende de framework, build ou rede. Tudo é opt-in por
   atributo data-*, então a página só ganha o que declarar.
   Respeita prefers-reduced-motion em todas as animações.
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

  /*
     Calculadora ATM de referência do kit.
     Última verificação: 04/08/2026 · Brasil · planos Standard.
     A conta soma os custos conhecidos da rota: conversão, IOF e tarifa própria
     do cartão. A tarifa do operador do ATM e o DCC são variáveis e ficam no
     disclaimer da peça. Fontes e escopo: contrato ATM_CALCULATOR.md do kit.
  */
  var atmTariffs = {
    arq: { withdrawalRate: 0.01, conversionRate: 0.005 },
    wise: { freeWithdrawals: 1, fixedFee: 20, conversionRate: 0.0078 },
    revolut: {
      freeWithdrawals: 5,
      freeLimit: 1600,
      withdrawalRate: 0.02,
      minimumFee: 6,
      exchangeFreeLimit: 1000,
      exchangeRate: 0.014,
    },
  };
  var atmDefaultIofRate = 0.011;

  /* ---------- 1 · Barra de progresso de leitura -------------
     <div class="read-progress" data-progress-for=".article-body"></div> */
  function initProgress() {
    var bar = document.querySelector("[data-progress-for]");
    if (!bar) return;
    var target = document.querySelector(bar.getAttribute("data-progress-for"));
    if (!target) return;
    var fill = bar.firstElementChild || bar.appendChild(document.createElement("span"));
    var raf = null;
    function update() {
      raf = null;
      var box = target.getBoundingClientRect();
      var total = box.height - window.innerHeight;
      var done = total > 0 ? (-box.top) / total : 0;
      fill.style.width = Math.max(0, Math.min(1, done)) * 100 + "%";
    }
    function onScroll() { if (raf === null) raf = requestAnimationFrame(update); }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* ---------- 2 · Sumário que acompanha a leitura -----------
     <nav class="piece-toc" data-toc-watch=".article-body h2">
     Marca o link ativo com .is-current e monta a lista se estiver vazia. */
  function initToc() {
    var toc = document.querySelector("[data-toc-watch]");
    if (!toc) return;
    var heads = Array.prototype.slice.call(document.querySelectorAll(toc.getAttribute("data-toc-watch")));
    if (!heads.length) return;
    var list = toc.querySelector("ol") || toc.appendChild(document.createElement("ol"));
    var links = [];

    heads.forEach(function (h, i) {
      if (!h.id) h.id = "sec-" + (i + 1);
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
      links.push(a);
    });

    if (!("IntersectionObserver" in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = heads.indexOf(e.target);
        links.forEach(function (a, j) { a.classList.toggle("is-current", j === i); });
      });
    }, { rootMargin: "-84px 0px -70% 0px" });
    heads.forEach(function (h) { obs.observe(h); });
  }

  /* ---------- 3 · Entrada dos blocos ------------------------
     Qualquer elemento com [data-reveal] sobe e aparece ao entrar
     na tela, uma vez. Sem JS (ou com reduced-motion) ele já está
     visível: o CSS só esconde sob .js-reveal-ready. */
  function initReveal() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length || reduced || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal-ready");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        obs.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    nodes.forEach(function (n) { obs.observe(n); });
  }

  /* ---------- 4 · Números que contam ------------------------
     <p class="figure-value" data-count-to="1" data-suffix="%"></p>
     Escreve o valor final de imediato se houver reduced-motion. */
  function initCounters() {
    var cells = Array.prototype.slice.call(document.querySelectorAll("[data-count-to]"));
    if (!cells.length) return;
    function write(el, v) {
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      el.textContent = (el.getAttribute("data-prefix") || "") +
        v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
        (el.getAttribute("data-suffix") || "");
    }
    function run(el) {
      var to = parseFloat(el.getAttribute("data-count-to"));
      if (reduced) return write(el, to);
      var t0 = null, dur = 900;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        write(el, to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (!("IntersectionObserver" in window)) return cells.forEach(run);
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target); obs.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    cells.forEach(function (c) { obs.observe(c); });
  }

  /* ---------- 5 · Filtro de catálogo por situação -----------
     <div data-filter-group>
       <button data-filter="viagem" aria-pressed="false">Vou viajar</button> …
     Cards: <a class="entry-card" data-situations="viagem custos"> …
     Sem seleção mostra tudo. O filtro ativo fica só na URL (#), não no storage. */
  function initFilters() {
    var group = document.querySelector("[data-filter-group]");
    if (!group) return;
    var buttons = Array.prototype.slice.call(group.querySelectorAll("[data-filter]"));
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-situations]"));
    var countEl = document.querySelector("[data-filter-count]");
    var baseUrl = window.location.pathname + window.location.search;
    var active = "";

    function readHash() {
      var value = window.location.hash.replace(/^#/, "");
      try {
        value = decodeURIComponent(value);
      } catch (error) {
        value = "";
      }
      return buttons.some(function (button) { return button.getAttribute("data-filter") === value; }) ? value : "";
    }

    function writeHash() {
      if (!window.history || !window.history.replaceState) return;
      window.history.replaceState(null, "", active ? baseUrl + "#" + encodeURIComponent(active) : baseUrl);
    }

    function apply() {
      var shown = 0;
      cards.forEach(function (card) {
        var ok = !active || (" " + card.getAttribute("data-situations") + " ").indexOf(" " + active + " ") > -1;
        card.hidden = !ok;
        if (ok) shown++;
      });
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === active));
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? " peça" : " peças");
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        active = b.getAttribute("data-filter") === active ? "" : b.getAttribute("data-filter");
        writeHash();
        apply();
      });
    });
    active = readHash();
    window.addEventListener("hashchange", function () {
      active = readHash();
      apply();
    });
    apply();
  }

  /* ---------- 6 · Calculadora de custo conhecido do saque --
     <form data-calc="atm"> com inputs [data-calc-value] e [data-calc-count]
     e saídas [data-out="arq|wise|revolut"], barras [data-bar="..."],
     veredito [data-calc-verdict]. [data-calc-iof] é opcional e recebe
     percentual; sem ele, usa a premissa de 1,1% para conversão de conta
     global. O custo do ATM e DCC não entram: são disclaimer da peça. */
  function atmMonthlyCost(value, count, iofRate) {
    var totalValue = value * count;
    var arqConversion = totalValue * atmTariffs.arq.conversionRate;
    var arqWithdrawal = totalValue * atmTariffs.arq.withdrawalRate;
    var wiseConversion = totalValue * (atmTariffs.wise.conversionRate + iofRate);
    var wiseWithdrawal = 0;
    var revolutIof = totalValue * iofRate;
    var revolutExchange = Math.max(totalValue - atmTariffs.revolut.exchangeFreeLimit, 0) * atmTariffs.revolut.exchangeRate;
    var revolutWithdrawal = 0;
    var accumulated = 0;
    for (var i = 0; i < count; i += 1) {
      wiseWithdrawal += i < atmTariffs.wise.freeWithdrawals ? 0 : atmTariffs.wise.fixedFee;
      var freeRevolut = i < atmTariffs.revolut.freeWithdrawals &&
        accumulated + value <= atmTariffs.revolut.freeLimit;
      revolutWithdrawal += freeRevolut ? 0 : Math.max(value * atmTariffs.revolut.withdrawalRate, atmTariffs.revolut.minimumFee);
      accumulated += value;
    }
    return {
      arq: {
        total: arqConversion + arqWithdrawal,
        conversion: arqConversion,
        iof: 0,
        withdrawal: arqWithdrawal,
        detail: "conversão + IOF + spread/serviço " + fmtBRL.format(arqConversion) + " · cartão " + fmtBRL.format(arqWithdrawal),
      },
      wise: {
        total: wiseConversion + wiseWithdrawal,
        conversion: totalValue * atmTariffs.wise.conversionRate,
        iof: totalValue * iofRate,
        withdrawal: wiseWithdrawal,
        detail: "conversão " + fmtBRL.format(totalValue * atmTariffs.wise.conversionRate) + " · IOF " + fmtBRL.format(totalValue * iofRate) + " · cartão " + fmtBRL.format(wiseWithdrawal),
      },
      revolut: {
        total: revolutIof + revolutExchange + revolutWithdrawal,
        conversion: revolutExchange,
        iof: revolutIof,
        withdrawal: revolutWithdrawal,
        detail: "câmbio " + fmtBRL.format(revolutExchange) + " · IOF " + fmtBRL.format(revolutIof) + " · cartão " + fmtBRL.format(revolutWithdrawal),
      },
    };
  }

  function initAtmCalc() {
    var form = document.querySelector('[data-calc="atm"]');
    if (!form) return;
    var valueIn = form.querySelector("[data-calc-value]");
    var countIn = form.querySelector("[data-calc-count]");
    var iofIn = form.querySelector("[data-calc-iof]");
    if (!valueIn || !countIn) return;
    var verdict = form.querySelector("[data-calc-verdict]");
    var names = { arq: "ARQ", wise: "Wise", revolut: "Revolut" };

    function render() {
      var value = Math.max(Number(valueIn.value) || 0, 0);
      var count = Math.max(Math.floor(Number(countIn.value) || 1), 1);
      var iofPercent = iofIn ? Math.max(Number(iofIn.value) || 0, 0) : atmDefaultIofRate * 100;
      var cost = atmMonthlyCost(value, count, iofPercent / 100);
      var keys = Object.keys(cost);
      var max = Math.max.apply(null, keys.map(function (key) { return cost[key].total; }).concat(1));
      var best = keys.reduce(function (winner, candidate) {
        return cost[candidate].total < cost[winner].total ? candidate : winner;
      }, "arq");

      form.querySelectorAll("[data-echo-value]").forEach(function (el) {
        el.textContent = fmtBRL.format(value);
      });
      form.querySelectorAll("[data-echo-count]").forEach(function (el) {
        el.textContent = count + (count === 1 ? " saque" : " saques");
      });
      form.querySelectorAll("[data-echo-iof]").forEach(function (el) {
        el.textContent = iofPercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
      });

      keys.forEach(function (key) {
        var output = form.querySelector('[data-out="' + key + '"]');
        var bar = form.querySelector('[data-bar="' + key + '"]');
        var row = form.querySelector('[data-row="' + key + '"]');
        var detail = form.querySelector('[data-detail="' + key + '"]') ||
          (output && output.querySelector("[data-calc-detail]"));
        var total = fmtBRL.format(cost[key].total);
        if (output) {
          var totalEl = output.querySelector("[data-calc-total]");
          if (totalEl) totalEl.textContent = total;
          else output.textContent = total;
        }
        if (detail) detail.textContent = cost[key].detail;
        if (bar) {
          bar.style.width = (cost[key].total / max) * 100 + "%";
          bar.classList.toggle("is-best", key === best);
        }
        if (row) row.classList.toggle("is-best", key === best);
      });

      if (verdict) {
        var second = keys.filter(function (key) { return key !== best; })
          .sort(function (a, b) { return cost[a].total - cost[b].total; })[0];
        var difference = cost[second].total - cost[best].total;
        verdict.textContent = difference <= 0
          ? "Empate nesse cenário — decida pela conveniência."
          : names[best] + " economiza " + fmtBRL.format(difference) + " por mês em relação ao " + names[second] + ", sem contar a tarifa variável do ATM ou o DCC.";
      }
    }

    [valueIn, countIn, iofIn].forEach(function (input) {
      if (input) input.addEventListener("input", render);
    });
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    render();
  }

  /* ---------- 7 · Progresso de guia -------------------------
     <main data-guide-progress="slug">
       <span data-guide-progress-fill></span>
       <span data-guide-progress-label></span>
       <section class="guide-step"><input data-guide-check> …
     O estado fica somente no navegador e a página funciona sem JS. */
  function initGuideProgress() {
    var root = document.querySelector("[data-guide-progress]");
    if (!root) return;
    var checks = Array.prototype.slice.call(root.querySelectorAll("[data-guide-check]"));
    if (!checks.length) return;
    var storageKey = "dlt-guide:" + (root.getAttribute("data-guide-progress") || window.location.pathname);
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}"); }
    catch (e) { saved = {}; }

    var fill = root.querySelector("[data-guide-progress-fill]");
    var label = root.querySelector("[data-guide-progress-label]");

    function update() {
      var done = 0;
      checks.forEach(function (check, index) {
        var id = check.getAttribute("data-guide-check") || String(index + 1);
        check.checked = Boolean(saved[id]);
        var step = check.closest(".guide-step");
        if (step) step.classList.toggle("is-done", check.checked);
        if (check.checked) done++;
      });
      if (fill) fill.style.width = Math.round(done / checks.length * 100) + "%";
      if (label) label.textContent = done + " de " + checks.length + " concluídos";
    }

    checks.forEach(function (check, index) {
      var id = check.getAttribute("data-guide-check") || String(index + 1);
      check.addEventListener("change", function () {
        saved[id] = check.checked;
        try { window.localStorage.setItem(storageKey, JSON.stringify(saved)); }
        catch (e) { /* progresso continua na sessão mesmo sem storage */ }
        update();
      });
    });
    update();
  }

  /* ---------- 8 · Calculadoras específicas ------------------
     Outras calculadoras continuam específicas da peça. O ATM é o único
     padrão compartilhado porque faz parte da biblioteca de interações. */

  /* ---------- 9 · FAQ: um aberto por vez -------------------
     <div class="faq" data-faq-exclusive> */
  function initFaq() {
    var wrap = document.querySelector("[data-faq-exclusive]");
    if (!wrap) return;
    var items = Array.prototype.slice.call(wrap.querySelectorAll("details"));
    items.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  }

  /* ---------- 10 · Compartilhar (padrão 28) ------------------
     <div class="share-row" data-share>
       <button data-share-copy>Copiar link</button>
       <a data-share-telegram></a> <a data-share-whatsapp></a> <a data-share-x></a>
     O href sai montado daqui: nenhum SDK de rede social, nenhum pixel. */
  function initShare() {
    var row = document.querySelector("[data-share]");
    if (!row) return;
    var url = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title.replace(/ — DLT Academy$/, ""));

    var targets = {
      telegram: "https://t.me/share/url?url=" + url + "&text=" + title,
      whatsapp: "https://wa.me/?text=" + title + "%20" + url,
      x: "https://twitter.com/intent/tweet?text=" + title + "&url=" + url
    };
    Object.keys(targets).forEach(function (k) {
      var a = row.querySelector("[data-share-" + k + "]");
      if (a) a.href = targets[k];
    });

    var copy = row.querySelector("[data-share-copy]");
    if (!copy) return;
    var label = copy.textContent;
    copy.addEventListener("click", function () {
      var done = function () {
        copy.textContent = "Link copiado";
        copy.classList.add("is-done");
        window.setTimeout(function () {
          copy.textContent = label;
          copy.classList.remove("is-done");
        }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(done, done);
      else done();
    });
  }

  /* ---------- 11 · Copiar o resultado (padrão 29) -----------
     <button data-copy-result="#resultado">Copiar como texto</button>
     Lê o texto visível do bloco apontado — nada é enviado. */
  function initCopyResult() {
    var btns = Array.prototype.slice.call(document.querySelectorAll("[data-copy-result]"));
    btns.forEach(function (btn) {
      var label = btn.textContent;
      btn.addEventListener("click", function () {
        var src = document.querySelector(btn.getAttribute("data-copy-result"));
        if (!src) return;
        var txt = src.innerText.replace(/\n{3,}/g, "\n\n").trim() +
          "\n\n" + window.location.href +
          "\nConteúdo educacional. Não é recomendação de investimento.";
        var done = function () {
          btn.textContent = "Copiado";
          btn.classList.add("is-done");
          window.setTimeout(function () {
            btn.textContent = label;
            btn.classList.remove("is-done");
          }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done);
        else done();
      });
    });
  }

  function boot() {
    initProgress(); initToc(); initReveal(); initCounters();
    initFilters(); initAtmCalc(); initGuideProgress(); initFaq(); initShare(); initCopyResult();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
