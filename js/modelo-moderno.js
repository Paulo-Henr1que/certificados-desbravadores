/* Modelo "Moderno": A4 deitada, fundo branco geométrico, cantos em
   azul, ouro e vermelho, título CERTIFICADO com faixa ESPECIALIDADE,
   texto corrido com nome e especialidade em destaque, duas assinaturas
   (Diretor e Instrutor(a)), emblema dos Desbravadores à esquerda e o
   boton da especialidade à direita.
   Tudo é desenhado em frações de W e H, então serve para qualquer
   resolução. */
(function () {
  'use strict';

  var AZUL = '#1F3C88', OURO = '#FFC20E', LARANJA = '#F7941D', VERM = '#EE3B2B', TINTA = '#111111';
  var SANS = '"Open Sans", Arial, Helvetica, sans-serif';
  var TITULO = 'Outfit, "Open Sans", Arial, sans-serif';

  var emblema = new Image();
  emblema.src = 'assets/desbravadores.svg';

  /* fundo "low poly" cinza bem claro, sempre igual (semente fixa) */
  function poligonos (ctx, W, H) {
    var s = 7;
    function rnd () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
    var cols = 9, lins = 6, p = [];
    for (var j = 0; j <= lins; j++) {
      p[j] = [];
      for (var i = 0; i <= cols; i++) {
        var borda = i === 0 || j === 0 || i === cols || j === lins;
        p[j][i] = [
          (i + (borda ? 0 : (rnd() - 0.5) * 0.8)) * W / cols,
          (j + (borda ? 0 : (rnd() - 0.5) * 0.8)) * H / lins,
        ];
      }
    }
    function tri (a, b, c) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      ctx.fillStyle = 'rgba(30,40,60,' + (0.012 + rnd() * 0.045).toFixed(3) + ')';
      ctx.fill();
    }
    for (var y = 0; y < lins; y++) {
      for (var x = 0; x < cols; x++) {
        tri(p[y][x], p[y][x + 1], p[y + 1][x]);
        tri(p[y][x + 1], p[y + 1][x + 1], p[y + 1][x]);
      }
    }
  }

  function poli (ctx, W, H, pts, cor) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
    ctx.closePath();
    ctx.fillStyle = cor; ctx.fill();
  }

  function pontos (ctx, W, H, x0, y0, cols, lins, passo, cor) {
    ctx.fillStyle = cor;
    var r = 0.0042 * H;
    for (var j = 0; j < lins; j++) for (var i = 0; i < cols; i++) {
      ctx.beginPath();
      ctx.arc((x0 + i * passo) * W, y0 * H + j * passo * W, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function barra (ctx, W, H, x1, y1, x2, y2, larg, cor) {
    ctx.strokeStyle = cor; ctx.lineCap = 'round'; ctx.lineWidth = larg * H;
    ctx.beginPath(); ctx.moveTo(x1 * W, y1 * H); ctx.lineTo(x2 * W, y2 * H); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function listras (ctx, W, H, x, y, w, h, cor) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x * W, y * H, w * W, h * H); ctx.clip();
    ctx.strokeStyle = cor; ctx.lineWidth = 0.006 * H;
    for (var k = -h * H; k < w * W + h * H; k += 0.016 * H) {
      ctx.beginPath(); ctx.moveTo(x * W + k, y * H); ctx.lineTo(x * W + k - h * H, (y + h) * H); ctx.stroke();
    }
    ctx.restore();
  }

  function cantos (ctx, W, H) {
    // superior esquerdo: blocos e triângulos
    poli(ctx, W, H, [[0, 0.06], [0.075, 0.17], [0.075, 0.30], [0, 0.34]], OURO);
    poli(ctx, W, H, [[0, 0.17], [0.06, 0.22], [0, 0.27]], LARANJA);
    poli(ctx, W, H, [[0.012, 0.04], [0.066, 0.095], [0.012, 0.15]], VERM);
    poli(ctx, W, H, [[0.012, 0.155], [0.06, 0.205], [0.012, 0.255]], VERM);
    poli(ctx, W, H, [[0.105, 0.085], [0.145, 0.125], [0.105, 0.165]], VERM);
    poli(ctx, W, H, [[0.10, 0.175], [0.10, 0.235], [0.065, 0.205]], AZUL);
    poli(ctx, W, H, [[0.15, 0.025], [0.18, 0.055], [0.15, 0.085]], AZUL);
    poli(ctx, W, H, [[0.0, 0.0], [0.045, 0.0], [0.0, 0.05]], AZUL);
    listras(ctx, W, H, 0.065, 0.0, 0.08, 0.085, LARANJA);

    // superior direito: azul, faixa ouro, barra vermelha e pontinhos
    poli(ctx, W, H, [[0.80, 0], [1, 0], [1, 0.40]], AZUL);
    poli(ctx, W, H, [[0.775, 0], [0.86, 0], [1, 0.22], [1, 0.34]], OURO);
    barra(ctx, W, H, 0.905, 0.14, 0.975, 0.28, 0.042, VERM);
    barra(ctx, W, H, 0.80, 0.0, 0.86, 0.09, 0.03, VERM);
    pontos(ctx, W, H, 0.962, 0.04, 2, 4, 0.0125, 'rgba(255,255,255,.9)');

    // inferior esquerdo: azul, faixas ouro e laranja, pontinhos
    poli(ctx, W, H, [[0, 0.60], [0.21, 1], [0, 1]], AZUL);
    poli(ctx, W, H, [[0, 0.56], [0.05, 0.56], [0.27, 1], [0.21, 1]], OURO);
    poli(ctx, W, H, [[0, 0.70], [0.17, 1], [0.13, 1], [0, 0.77]], LARANJA);
    pontos(ctx, W, H, 0.014, 0.875, 2, 4, 0.0125, 'rgba(255,255,255,.9)');

    // inferior direito: faixa ouro, vermelho e azul
    poli(ctx, W, H, [[1, 0.70], [1, 1], [0.86, 1]], OURO);
    poli(ctx, W, H, [[1, 0.74], [1, 0.84], [0.965, 0.79]], VERM);
    poli(ctx, W, H, [[1, 0.86], [1, 1], [0.93, 1]], AZUL);
  }

  /* faixa azul com pontas recortadas, como no modelo */
  function faixa (ctx, W, H, cx, cy, w, h) {
    var x0 = (cx - w / 2) * W, x1 = (cx + w / 2) * W, y0 = (cy - h / 2) * H, y1 = (cy + h / 2) * H, n = 0.022 * W;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1 - n, cy * H); ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1); ctx.lineTo(x0 + n, cy * H); ctx.closePath();
    ctx.fillStyle = AZUL; ctx.fill();
  }

  function espacado (ctx, txt, x, y, esp) {
    // texto centrado com espaçamento entre letras
    var total = 0, larg = [];
    for (var i = 0; i < txt.length; i++) { larg[i] = ctx.measureText(txt[i]).width; total += larg[i] + (i ? esp : 0) }
    var cx = x - total / 2;
    ctx.textAlign = 'left';
    for (var k = 0; k < txt.length; k++) { ctx.fillText(txt[k], cx, y); cx += larg[k] + esp }
  }

  /* parágrafo centrado com trechos em negrito; quebra por palavra.
     Cada trecho: { t: texto, b: negrito, k: tamanho relativo, inteiro: não quebra } */
  function paragrafo (ctx, trechos, cx, y, largMax, tam, entre) {
    var fonte = function (tr) { return (tr.b ? '700 ' : '400 ') + Math.round(tam * (tr.k || 1)) + 'px ' + SANS };
    var pal = [];
    trechos.forEach(function (tr) {
      if (tr.inteiro) { pal.push({ t: tr.t, f: fonte(tr) }); return }
      tr.t.split(/(\s+)/).forEach(function (p) { if (p) pal.push({ t: p, f: fonte(tr) }) });
    });
    var linhas = [[]], larguras = [0];
    pal.forEach(function (p) {
      ctx.font = p.f; p.w = ctx.measureText(p.t).width;
      var L = linhas.length - 1;
      var branco = /^\s+$/.test(p.t);
      if (!branco && larguras[L] + p.w > largMax && linhas[L].length) {
        while (linhas[L].length && /^\s+$/.test(linhas[L][linhas[L].length - 1].t)) larguras[L] -= linhas[L].pop().w;
        linhas.push([]); larguras.push(0); L++;
      }
      if (branco && !linhas[L].length) return;
      linhas[L].push(p); larguras[L] += p.w;
    });
    ctx.fillStyle = TINTA; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    linhas.forEach(function (ln, i) {
      var x = cx - larguras[i] / 2;
      ln.forEach(function (p) { ctx.font = p.f; ctx.fillText(p.t, x, y + i * entre); x += p.w });
    });
    return linhas.length;
  }

  function encaixar (ctx, im, x, y, w, h) {
    var e = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    var iw = im.naturalWidth * e, ih = im.naturalHeight * e;
    ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  function retArred (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  window.desenharModerno = function (ctx, W, H, d, nomeQueCabe) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F1F2F4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    poligonos(ctx, W, H);
    cantos(ctx, W, H);

    // cabeçalho
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = AZUL; ctx.textAlign = 'center';
    ctx.font = '500 ' + Math.round(0.026 * H) + 'px ' + TITULO;
    espacado(ctx, 'Divisão Sul-Americana da IASD', 0.5 * W, 0.048 * H, 0.0018 * W);

    ctx.fillStyle = VERM;
    ctx.font = '800 ' + Math.round(0.125 * H) + 'px ' + TITULO;
    espacado(ctx, 'CERTIFICADO', 0.5 * W, 0.225 * H, 0.008 * W);

    faixa(ctx, W, H, 0.5, 0.288, 0.33, 0.062);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 ' + Math.round(0.040 * H) + 'px ' + TITULO;
    espacado(ctx, 'ESPECIALIDADE', 0.5 * W, 0.303 * H, 0.004 * W);

    // texto corrido
    var tam = Math.round(0.034 * H), largMax = 0.80 * W;
    var nome = (d.nome || '').toUpperCase();
    var tamNome = 1.55;
    ctx.font = '700 ' + Math.round(tam * tamNome) + 'px ' + SANS;
    // nome nunca maior que a linha: encolhe e, se preciso, abrevia
    var limiteNome = 0.62 * W;
    if (ctx.measureText(nome).width > limiteNome) {
      if (nomeQueCabe) nome = nomeQueCabe(ctx, nome, limiteNome * 0.92, tam * 1.05 / 0.72);
      while (tamNome > 1.05) {
        ctx.font = '700 ' + Math.round(tam * tamNome) + 'px ' + SANS;
        if (ctx.measureText(nome).width <= limiteNome) break;
        tamNome -= 0.05;
      }
    }
    var esp = (d.especialidade || '').toUpperCase();
    var n = paragrafo(ctx, [
      { t: 'Certificamos que ' },
      { t: nome, b: true, k: tamNome, inteiro: true },
      { t: ' concluiu a Especialidade de ' },
      { t: esp, b: true, inteiro: esp.length < 40 },
      { t: ', do Ministério dos DESBRAVADORES, válida em todo o território da Divisão Sul-Americana da Igreja Adventista do Sétimo Dia' },
    ], 0.5 * W, 0.47 * H, largMax, tam, 0.052 * H);

    // data
    var yData = 0.47 * H + n * 0.052 * H + 0.035 * H;
    paragrafo(ctx, [{ t: 'Concluído em ' }, { t: d.data || '___ / ___ / ______', b: true, inteiro: true }],
      0.5 * W, Math.min(yData, 0.70 * H), largMax, Math.round(0.028 * H), 0.04 * H);

    // duas assinaturas
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, 0.0022 * H);
    [[0.285, 0.475, 'Diretor'], [0.525, 0.715, 'Instrutor(a)']].forEach(function (a) {
      ctx.beginPath(); ctx.moveTo(a[0] * W, 0.815 * H); ctx.lineTo(a[1] * W, 0.815 * H); ctx.stroke();
      ctx.fillStyle = TINTA; ctx.textAlign = 'center';
      ctx.font = '700 ' + Math.round(0.027 * H) + 'px ' + SANS;
      ctx.fillText(a[2], ((a[0] + a[1]) / 2) * W, 0.855 * H);
    });

    // emblema dos Desbravadores
    if (emblema.naturalWidth) encaixar(ctx, emblema, 0.022 * W, 0.69 * H, 0.19 * W, 0.29 * H);

    // boton no lugar do QR code: quadro branco
    var bx = 0.815 * W, by = 0.735 * H, bw = 0.155 * W, bh = 0.235 * H;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 0.02 * H; ctx.shadowOffsetY = 0.004 * H;
    retArred(ctx, bx, by, bw, bh, 0.012 * H);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    if (d.botao) {
      encaixar(ctx, d.botao, bx + 0.08 * bw, by + 0.06 * bh, bw * 0.84, bh * 0.88);
    } else {
      ctx.strokeStyle = '#D5DAE2'; ctx.setLineDash([0.01 * H, 0.008 * H]); ctx.lineWidth = 0.003 * H;
      ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.36, bh * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  /* Modelo 2 "Compacto": mesmo estilo do grande, no formato da faixa
     (2,70 : 1) para sair 3, 2 ou 1 por folha. Uma assinatura só.
     Medidas em H (altura) para as formas não esticarem. */
  window.desenharCompacto = function (ctx, W, H, d, nomeQueCabe, escurecer) {
    var u = H;
    function P (pts, cor) {
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var x = p[0] < 0 ? W + p[0] * u : p[0] * u;
        if (i) ctx.lineTo(x, p[1] * u); else ctx.moveTo(x, p[1] * u);
      });
      ctx.closePath(); ctx.fillStyle = cor; ctx.fill();
    }
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F1F2F4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    poligonos(ctx, W, H);

    // canto superior esquerdo
    P([[0, 0.10], [0.14, 0.24], [0.14, 0.42], [0, 0.50]], OURO);
    P([[0.02, 0.06], [0.12, 0.15], [0.02, 0.24]], VERM);
    P([[0.02, 0.27], [0.10, 0.35], [0.02, 0.43]], VERM);
    P([[0.20, 0.10], [0.27, 0.17], [0.20, 0.24]], VERM);
    P([[0.30, 0.03], [0.35, 0.08], [0.30, 0.13]], AZUL);
    P([[0, 0], [0.09, 0], [0, 0.08]], AZUL);
    listras(ctx, W, H, 0.12 * u / W, 0, 0.15 * u / W, 0.12, LARANJA);
    // canto inferior esquerdo
    P([[0, 0.62], [0.26, 1], [0, 1]], AZUL);
    P([[0, 0.54], [0.08, 0.54], [0.40, 1], [0.30, 1]], OURO);
    P([[0, 0.74], [0.18, 1], [0.12, 1], [0, 0.83]], LARANJA);
    // canto superior direito
    P([[-0.42, 0], [-0.0001, 0], [-0.0001, 0.50]], AZUL);
    P([[-0.50, 0], [-0.36, 0], [-0.0001, 0.27], [-0.0001, 0.40]], OURO);
    ctx.strokeStyle = VERM; ctx.lineCap = 'round'; ctx.lineWidth = 0.06 * u;
    ctx.beginPath(); ctx.moveTo(W - 0.20 * u, 0.04 * u); ctx.lineTo(W - 0.07 * u, 0.20 * u); ctx.stroke();
    ctx.lineCap = 'butt';
    // canto inferior direito
    P([[-0.0001, 0.70], [-0.0001, 1], [-0.30, 1]], OURO);
    P([[-0.0001, 0.86], [-0.0001, 1], [-0.12, 1]], AZUL);

    var cx = 0.425 * W; // centro da área de texto (o boton fica à direita)
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = VERM;
    ctx.font = '800 ' + Math.round(0.165 * H) + 'px ' + TITULO;
    espacado(ctx, 'CERTIFICADO', cx, 0.255 * H, 0.010 * H);

    // faixa ESPECIALIDADE
    var fw = 0.58 * H, fh = 0.088 * H, fy = 0.345 * H, n = 0.042 * H;
    ctx.beginPath();
    ctx.moveTo(cx - fw / 2 - n, fy - fh / 2); ctx.lineTo(cx + fw / 2 + n, fy - fh / 2); ctx.lineTo(cx + fw / 2, fy);
    ctx.lineTo(cx + fw / 2 + n, fy + fh / 2); ctx.lineTo(cx - fw / 2 - n, fy + fh / 2); ctx.lineTo(cx - fw / 2, fy); ctx.closePath();
    ctx.fillStyle = AZUL; ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 ' + Math.round(0.054 * H) + 'px ' + TITULO;
    espacado(ctx, 'ESPECIALIDADE', cx, fy + 0.019 * H, 0.007 * H);

    // texto: nome e especialidade em destaque
    var tam = Math.round(0.056 * H), largMax = 0.56 * W;
    var nome = (d.nome || '').toUpperCase(), kNome = 1.35;
    var limiteNome = 0.36 * W;
    ctx.font = '700 ' + Math.round(tam * kNome) + 'px ' + SANS;
    if (ctx.measureText(nome).width > limiteNome) {
      if (nomeQueCabe) nome = nomeQueCabe(ctx, nome, limiteNome * 0.92, tam * 1.0 / 0.72);
      while (kNome > 1.0) {
        ctx.font = '700 ' + Math.round(tam * kNome) + 'px ' + SANS;
        if (ctx.measureText(nome).width <= limiteNome) break;
        kNome -= 0.05;
      }
    }
    var esp = (d.especialidade || '').toUpperCase();
    var corEsp = escurecer ? escurecer(d.cor || '#08A008') : TINTA;
    var linhas = paragrafoCor(ctx, [
      { t: 'Certificamos que ' },
      { t: nome, b: true, k: kNome, inteiro: true },
      { t: ' concluiu a Especialidade de ' },
      { t: esp, b: true, inteiro: esp.length < 34, cor: corEsp },
    ], cx, 0.525 * H, largMax, tam, 0.085 * H);

    paragrafoCor(ctx, [{ t: 'Concluído em ' }, { t: d.data || '___ / ___ / ______', b: true, inteiro: true }],
      cx, Math.min(0.525 * H + linhas * 0.085 * H + 0.01 * H, 0.725 * H), largMax, Math.round(0.046 * H), 0.07 * H);

    // assinatura única
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, 0.005 * H);
    ctx.beginPath(); ctx.moveTo(cx - 0.10 * W, 0.85 * H); ctx.lineTo(cx + 0.10 * W, 0.85 * H); ctx.stroke();
    ctx.fillStyle = TINTA; ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(0.046 * H) + 'px ' + SANS;
    ctx.fillText('Instrutor@', cx, 0.925 * H);

    // emblema
    if (emblema.naturalWidth) encaixar(ctx, emblema, 0.03 * u, 0.56 * u, 0.36 * u, 0.40 * u);

    // boton: quadro branco à direita, borda na cor da especialidade
    var bh = 0.68 * H, bw = 0.60 * H, bx = W - bw - 0.13 * H, by = 0.16 * H;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.14)'; ctx.shadowBlur = 0.04 * H; ctx.shadowOffsetY = 0.008 * H;
    retArred(ctx, bx, by, bw, bh, 0.03 * H);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = d.cor || '#08A008'; ctx.lineWidth = 0.012 * H;
    retArred(ctx, bx, by, bw, bh, 0.03 * H); ctx.stroke();
    if (d.botao) {
      encaixar(ctx, d.botao, bx + 0.07 * bw, by + 0.06 * bh, bw * 0.86, bh * 0.88);
    } else {
      ctx.strokeStyle = '#D5DAE2'; ctx.setLineDash([0.02 * H, 0.016 * H]); ctx.lineWidth = 0.006 * H;
      ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.36, bh * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  /* igual ao paragrafo(), mas cada trecho pode ter cor própria */
  function paragrafoCor (ctx, trechos, cx, y, largMax, tam, entre) {
    var fonte = function (tr) { return (tr.b ? '700 ' : '400 ') + Math.round(tam * (tr.k || 1)) + 'px ' + SANS };
    var pal = [];
    trechos.forEach(function (tr) {
      if (tr.inteiro) { pal.push({ t: tr.t, f: fonte(tr), c: tr.cor }); return }
      tr.t.split(/(\s+)/).forEach(function (p) { if (p) pal.push({ t: p, f: fonte(tr), c: tr.cor }) });
    });
    var linhas = [[]], larg = [0];
    pal.forEach(function (p) {
      ctx.font = p.f; p.w = ctx.measureText(p.t).width;
      var L = linhas.length - 1, branco = /^\s+$/.test(p.t);
      if (!branco && larg[L] + p.w > largMax && linhas[L].length) {
        while (linhas[L].length && /^\s+$/.test(linhas[L][linhas[L].length - 1].t)) larg[L] -= linhas[L].pop().w;
        linhas.push([]); larg.push(0); L++;
      }
      if (branco && !linhas[L].length) return;
      linhas[L].push(p); larg[L] += p.w;
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    linhas.forEach(function (ln, i) {
      var x = cx - larg[i] / 2;
      ln.forEach(function (p) { ctx.font = p.f; ctx.fillStyle = p.c || TINTA; ctx.fillText(p.t, x, y + i * entre); x += p.w });
    });
    return linhas.length;
  }

  window.emblemaModerno = emblema;
})();
