/* Gerador de Certificados · Clube de Desbravadores
   Tudo roda no navegador. Nada é enviado para servidor.
   Os textos e lotes ficam no localStorage; as imagens, no IndexedDB
   (localStorage estoura com poucos botons de especialidade). */
(function () {
  'use strict';

  /* ═══════════ guarda de dados ═══════════ */

  var CHAVE = 'desbravadores-certificados-v1';
  function novoId () { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
  var estado = { especialidades: [], lotes: [], temLogo: false, modelo: 'classico' };

  function salvar () {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)) }
    catch (e) { aviso('Não deu para salvar neste navegador. Faça um backup.', true) }
  }
  var HEX = /^#[0-9a-fA-F]{6}$/;
  /* limpa o que vier do armazenamento ou de um backup: tipos errados,
     cores inválidas, lotes órfãos. Nada disso pode derrubar a página. */
  function sanear (cru) {
    var limpo = { especialidades: [], lotes: [], temLogo: false, modelo: 'classico' };
    if (!cru || typeof cru !== 'object') return limpo;
    (Array.isArray(cru.especialidades) ? cru.especialidades : []).forEach(function (e) {
      if (!e || typeof e.nome !== 'string' || !e.nome.trim() || !e.id) return;
      limpo.especialidades.push({
        id: String(e.id), nome: e.nome.trim().slice(0, 80),
        cor: HEX.test(e.cor) ? e.cor : '#08A008',
        imgId: e.imgId ? String(e.imgId) : null,
      });
    });
    var ids = {};
    limpo.especialidades.forEach(function (e) { ids[e.id] = true });
    (Array.isArray(cru.lotes) ? cru.lotes : []).forEach(function (l) {
      if (!l || !ids[l.espId] || !Array.isArray(l.nomes)) return;
      var nomes = l.nomes.filter(function (x) { return typeof x === 'string' && x.trim() })
        .map(function (x) { return x.trim().slice(0, 140) });
      if (!nomes.length) return;
      limpo.lotes.push({
        id: String(l.id || novoId()), espId: l.espId, nomes: nomes,
        tipoData: ['branco', 'ano', 'cheia'].indexOf(l.tipoData) > -1 ? l.tipoData : 'branco',
        dia: String(l.dia || '').slice(0, 2), mes: String(l.mes || '').slice(0, 2), ano: String(l.ano || '').slice(0, 4),
      });
    });
    limpo.temLogo = !!cru.temLogo;
    limpo.modelo = ['classico', 'compacto', 'moderno'].indexOf(cru.modelo) > -1 ? cru.modelo : 'classico';
    return limpo;
  }
  function carregar () {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) estado = sanear(JSON.parse(cru));
    } catch (e) { estado = sanear(null) }
  }

  /* IndexedDB só para as imagens */
  var bd = null, semBd = false, memoria = {};
  function abrirBd () {
    return new Promise(function (ok, erro) {
      if (bd) return ok(bd);
      if (semBd) return erro(new Error('sem IndexedDB'));
      try {
        var req = indexedDB.open('desbravadores-img', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('img') };
        req.onsuccess = function () { bd = req.result; ok(bd) };
        req.onerror = req.onblocked = function () { semBd = true; erro(req.error || new Error('bloqueado')) };
      } catch (e) { semBd = true; erro(e) }
    });
  }
  function guardarImg (id, dataUrl) {
    memoria[id] = dataUrl;
    return abrirBd().catch(function () { return null }).then(function (b) {
      if (!b) return;
      return new Promise(function (ok, erro) {
        var t = b.transaction('img', 'readwrite');
        t.objectStore('img').put(dataUrl, id);
        t.oncomplete = ok; t.onerror = function () { erro(t.error) };
      });
    });
  }
  function lerImg (id) {
    return abrirBd().catch(function () { return null }).then(function (b) {
      if (!b) return memoria[id] || null;
      return new Promise(function (ok) {
        var r = b.transaction('img', 'readonly').objectStore('img').get(id);
        r.onsuccess = function () { ok(r.result || memoria[id] || null) };
        r.onerror = function () { ok(null) };
      });
    });
  }
  function apagarImg (id) {
    delete memoria[id];
    return abrirBd().catch(function () { return null }).then(function (b) {
      if (!b) return;
      return new Promise(function (ok) {
        var t = b.transaction('img', 'readwrite');
        t.objectStore('img').delete(id);
        t.oncomplete = ok; t.onerror = ok;
      });
    });
  }

  /* cache de imagens já decodificadas */
  var cacheImg = {};
  function imagemDe (id) {
    if (!id) return Promise.resolve(null);
    if (cacheImg[id] !== undefined) return Promise.resolve(cacheImg[id]);
    return lerImg(id).then(function (url) {
      if (!url) { cacheImg[id] = null; return null }
      return new Promise(function (ok) {
        var im = new Image();
        im.onload = function () { cacheImg[id] = im; ok(im) };
        im.onerror = function () { cacheImg[id] = null; ok(null) };
        im.src = url;
      });
    });
  }

  /* ═══════════ utilidades ═══════════ */

  var $ = function (s) { return document.querySelector(s) };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)) };
  var id = function (s) { return document.getElementById(s) };

  var tAviso;
  function aviso (txt, erro) {
    var cx = id('aviso');
    id('aviso-txt').textContent = txt;
    cx.classList.toggle('erro', !!erro);
    cx.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(function () { cx.hidden = true }, erro ? 5200 : 3200);
  }

  function limpaNome (s) {
    return (s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  }

  /* reduz a imagem enviada: 700 certificados com botons grandes
     entopem a memória e o arquivo final */
  function prepararImagem (arquivo, ladoMax) {
    return new Promise(function (ok, erro) {
      var leitor = new FileReader();
      leitor.onload = function () {
        var im = new Image();
        im.onload = function () {
          var e = Math.min(1, ladoMax / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.round(im.naturalWidth * e), h = Math.round(im.naturalHeight * e);
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(im, 0, 0, w, h);
          ok(c.toDataURL('image/png'));
        };
        im.onerror = function () { erro(new Error('imagem inválida')) };
        im.src = leitor.result;
      };
      leitor.onerror = function () { erro(leitor.error) };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ═══════════ desenho do certificado ═══════════ */
  /* Proporção medida no modelo: 827 x 306 (2,70 : 1). */

  var PROPORCAO = 827 / 306;
  /* tom mais escuro da cor da moldura, para o nome da especialidade ler bem sobre o branco */
  function escurecer (hex) {
    var n = parseInt(hex.slice(1), 16), f = 0.72;
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  var logoPadrao = new Image();
  logoPadrao.onload = function () { if (typeof pintarPrevia === "function") pintarPrevia() };
  logoPadrao.src = "assets/logo-adventista-branca.png";

  function texto (ctx, txt, x, y, tam, peso, cor, alinha, larguraMax) {
    var t = tam;
    ctx.fillStyle = cor;
    ctx.textAlign = alinha || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = peso + ' ' + t + 'px "Open Sans", Calibri, Arial, sans-serif';
    if (larguraMax) {
      // encolhe até caber: nome comprido não pode vazar da moldura
      var guarda = 0;
      while (ctx.measureText(txt).width > larguraMax && t > 8 && guarda++ < 200) {
        t -= 1;
        ctx.font = peso + ' ' + t + 'px "Open Sans", Calibri, Arial, sans-serif';
      }
    }
    ctx.fillText(txt, x, y);
    return t;
  }

  /* Símbolo adventista desenhado: livro aberto, chama de três línguas
     e a cruz vazada no meio. Só é usado quando não há logotipo enviado
     — para o material oficial, suba o arquivo da igreja no passo 1. */
  function simbolo (ctx, cx, cy, tam, corFundo) {
    var u = tam / 100;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#FFFFFF';

    // livro aberto, na base
    ctx.beginPath();
    ctx.moveTo(-50 * u, 34 * u);
    ctx.quadraticCurveTo(-26 * u, 24 * u, -3 * u, 33 * u);
    ctx.lineTo(-3 * u, 50 * u);
    ctx.quadraticCurveTo(-26 * u, 41 * u, -50 * u, 50 * u);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(50 * u, 34 * u);
    ctx.quadraticCurveTo(26 * u, 24 * u, 3 * u, 33 * u);
    ctx.lineTo(3 * u, 50 * u);
    ctx.quadraticCurveTo(26 * u, 41 * u, 50 * u, 50 * u);
    ctx.closePath(); ctx.fill();

    // chama central
    ctx.beginPath();
    ctx.moveTo(0, -52 * u);
    ctx.bezierCurveTo(17 * u, -30 * u, 14 * u, -8 * u, 8 * u, 6 * u);
    ctx.bezierCurveTo(5 * u, 14 * u, 2 * u, 20 * u, 0, 24 * u);
    ctx.bezierCurveTo(-2 * u, 20 * u, -5 * u, 14 * u, -8 * u, 6 * u);
    ctx.bezierCurveTo(-14 * u, -8 * u, -17 * u, -30 * u, 0, -52 * u);
    ctx.closePath(); ctx.fill();

    // línguas laterais
    ctx.beginPath();
    ctx.moveTo(-20 * u, -34 * u);
    ctx.bezierCurveTo(-30 * u, -14 * u, -28 * u, 4 * u, -22 * u, 18 * u);
    ctx.bezierCurveTo(-33 * u, 4 * u, -34 * u, -16 * u, -20 * u, -34 * u);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20 * u, -34 * u);
    ctx.bezierCurveTo(30 * u, -14 * u, 28 * u, 4 * u, 22 * u, 18 * u);
    ctx.bezierCurveTo(33 * u, 4 * u, 34 * u, -16 * u, 20 * u, -34 * u);
    ctx.closePath(); ctx.fill();

    // cruz vazada, na cor da moldura
    ctx.fillStyle = corFundo || '#08A008';
    ctx.fillRect(-2.6 * u, -34 * u, 5.2 * u, 40 * u);
    ctx.fillRect(-11 * u, -21 * u, 22 * u, 5.2 * u);

    ctx.restore();
  }

  /* Nome comprido: primeiro tenta caber encolhendo até 80% da fonte.
     Se não der, abrevia os nomes do meio, um a um, do penúltimo para
     trás, mantendo o primeiro e o último nome inteiros. Partículas
     (de, da, dos...) somem antes de abreviar. Só então a função texto()
     encolhe o resto. Assim o nome nunca invade o oval. */
  var PARTICULAS = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };
  function nomeQueCabe (ctx, nome, largura, tam) {
    var limiteFonte = function (t) {
      ctx.font = '400 ' + Math.round(tam * 0.72) + 'px "Open Sans", Calibri, Arial, sans-serif';
      return ctx.measureText(t).width <= largura;
    };
    nome = nome.replace(/\s+/g, ' ').trim();
    if (limiteFonte(nome)) return nome;

    var p = nome.split(' ');
    if (p.length < 3) return nome;

    // tira as partículas do meio
    var meio = p.slice(1, -1).filter(function (x) { return !PARTICULAS[x.toLowerCase()] });
    var montar = function () { return [p[0]].concat(meio, p[p.length - 1]).join(' ') };
    var atual = montar();
    if (limiteFonte(atual)) return atual;

    // abrevia do penúltimo para trás: "Santos" vira "S."
    for (var i = meio.length - 1; i >= 0; i--) {
      meio[i] = meio[i].charAt(0).toUpperCase() + '.';
      atual = montar();
      if (limiteFonte(atual)) return atual;
    }
    return atual;
  }

  /* encaixa a imagem no oval sem deformar */
  function dentroDoOval (ctx, im, cx, cy, rx, ry) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    var e = Math.max((rx * 2) / im.naturalWidth, (ry * 2) / im.naturalHeight);
    var w = im.naturalWidth * e, h = im.naturalHeight * e;
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  function desenhar (ctx, W, H, d) {
    var cor = d.cor || '#08A008';
    ctx.clearRect(0, 0, W, H);

    // moldura colorida
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, W, H);

    // área branca como no modelo: borda verde fina em volta, faixa de
    // cima mais grossa à esquerda (onde fica a logo) e a curva que desce
    // do canto da logo até o pé esquerdo.
    var b = 0.035 * H;
    ctx.beginPath();
    ctx.moveTo(0.215 * W, 0.15 * H);
    ctx.bezierCurveTo(0.45 * W, 0.11 * H, 0.75 * W, b, W - b, b);
    ctx.lineTo(W - b, H - b);
    ctx.lineTo(0.05 * W, H - b);
    ctx.bezierCurveTo(0.085 * W, 0.62 * H, 0.12 * W, 0.26 * H, 0.215 * W, 0.15 * H);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // logo no canto verde, sempre na proporção original
    var lg = d.logo || logoPadrao;
    if (lg && lg.naturalWidth) {
      var lh = 0.40 * H, lw = lh * (lg.naturalWidth / lg.naturalHeight);
      if (lw > 0.115 * W) { lw = 0.115 * W; lh = lw * (lg.naturalHeight / lg.naturalWidth) }
      ctx.drawImage(lg, 0.075 * W - lw / 2, 0.055 * H, lw, lh);
    }

    var tinta = '#1B1B1B';

    // O oval fica em 0,834W: todo texto tem de caber à esquerda dele.
    var limite = 0.705 * W;

    // título fixo
    texto(ctx, 'Certificado de Especialidade', 0.500 * W, 0.312 * H,
      Math.round(0.111 * H), '400', tinta, 'center', 0.56 * W);

    // nome da especialidade
    texto(ctx, d.especialidade || '', 0.500 * W, 0.448 * H,
      Math.round(0.118 * H), '700', escurecer(cor), 'center', 0.44 * W);

    // desbravador
    var rotulo = 'Desbravador: ';
    var tamNome = Math.round(0.098 * H);
    ctx.font = '400 ' + tamNome + 'px "Open Sans", Calibri, Arial, sans-serif';
    var larguraRot = ctx.measureText(rotulo).width;
    var xNome = 0.135 * W;
    var espaco = limite - (xNome + larguraRot);
    var nome = nomeQueCabe(ctx, d.nome || '', espaco, tamNome);
    texto(ctx, rotulo, xNome, 0.630 * H, tamNome, '400', tinta, 'left');
    texto(ctx, nome, xNome + larguraRot, 0.630 * H,
      tamNome, '400', tinta, 'left', espaco);

    // data
    texto(ctx, d.data || '', 0.148 * W, 0.748 * H,
      Math.round(0.070 * H), '400', tinta, 'left', 0.34 * W);

    // linha de assinatura
    ctx.strokeStyle = '#2B2B2B';
    ctx.lineWidth = Math.max(1, 0.008 * H);
    ctx.beginPath();
    ctx.moveTo(0.372 * W, 0.868 * H);
    ctx.lineTo(0.700 * W, 0.868 * H);
    ctx.stroke();
    texto(ctx, '(Instrutor)', 0.536 * W, 0.942 * H,
      Math.round(0.058 * H), '400', tinta, 'center');

    // oval do boton da especialidade
    var cx = 0.834 * W, cy = 0.600 * H, rx = 0.103 * W, ry = 0.222 * H;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();

    if (d.botao) dentroDoOval(ctx, d.botao, cx, cy, rx * 0.885, ry * 0.885);

    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(2, 0.030 * H);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.010 * H);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.065, ry * 1.055, 0, 0, Math.PI * 2); ctx.stroke();
  }

  /* ═══════════ modelos ═══════════ */
  /* clássico: faixa 2,70:1 · moderno: A4 deitada (297 x 210) */
  function moderno () { return estado.modelo === 'moderno' && typeof window.desenharModerno === 'function' }
  function proporcao () { return moderno() ? 297 / 210 : PROPORCAO }
  function desenharAtual (ctx, W, H, d) {
    if (moderno()) window.desenharModerno(ctx, W, H, d, nomeQueCabe);
    else if (estado.modelo === 'compacto' && typeof window.desenharCompacto === 'function') window.desenharCompacto(ctx, W, H, d, nomeQueCabe, escurecer);
    else desenhar(ctx, W, H, d);
  }

  /* ═══════════ dados derivados ═══════════ */

  function espPorId (i) {
    for (var k = 0; k < estado.especialidades.length; k++) {
      if (estado.especialidades[k].id === i) return estado.especialidades[k];
    }
    return null;
  }

  function textoData (lote) {
    if (lote.tipoData === 'cheia') {
      var dd = (lote.dia || '').padStart(2, '0'), mm = (lote.mes || '').padStart(2, '0');
      return dd + ' / ' + mm + ' / ' + (lote.ano || '');
    }
    if (lote.tipoData === 'ano') return '___ / ___ / ' + (lote.ano || '');
    return '___ / ___ / ______';
  }

  function totalCertificados () {
    return estado.lotes.reduce(function (s, l) { return s + l.nomes.length }, 0);
  }

  /* lista achatada: um item por certificado */
  function todosOsCertificados () {
    var fora = [];
    estado.lotes.forEach(function (l) {
      var e = espPorId(l.espId);
      l.nomes.forEach(function (n) {
        fora.push({
          nome: n,
          especialidade: e ? e.nome : '(sem especialidade)',
          cor: e ? e.cor : '#08A008',
          imgId: e ? e.imgId : null,
          data: textoData(l),
        });
      });
    });
    return fora;
  }

  /* ═══════════ interface: especialidades ═══════════ */

  var editandoEsp = null;
  var imgPendente = null;

  /* listas longas ficam recolhidas, com "Ver mais" */
  var abertas = {};
  function recolher (el, chave, limite, rotulo) {
    var prox = el.nextElementSibling;
    if (prox && prox.classList.contains('ver-mais')) prox.remove();
    var itens = [].slice.call(el.children);
    var sobra = itens.length - limite;
    itens.forEach(function (it, i) { it.hidden = !abertas[chave] && i >= limite });
    if (sobra <= 0) return;
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'ver-mais' + (abertas[chave] ? ' aberto' : '');
    bt.innerHTML = '<span></span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
    bt.firstChild.textContent = abertas[chave] ? 'Ver menos' : 'Ver mais ' + sobra + ' ' + rotulo;
    bt.addEventListener('click', function () { abertas[chave] = !abertas[chave]; recolher(el, chave, limite, rotulo) });
    el.parentNode.insertBefore(bt, el.nextSibling);
  }

  function pintarEspecialidades () {
    var ul = id('lista-esp');
    ul.innerHTML = '';
    id('esp-vazio').hidden = estado.especialidades.length > 0;

    estado.especialidades.forEach(function (e) {
      var li = document.createElement('li');
      li.className = 'cartao-esp';

      var mini = document.createElement('div');
      if (e.imgId) {
        var img = document.createElement('img');
        img.className = 'mini-btn'; img.alt = '';
        imagemDe(e.imgId).then(function (im) { if (im) img.src = im.src });
        mini = img;
      } else {
        mini.className = 'mini-vazio';
        mini.textContent = 'sem boton';
      }

      var bol = document.createElement('span');
      bol.className = 'bolinha'; bol.style.background = e.cor;

      var meio = document.createElement('div');
      meio.className = 'meio';
      var b = document.createElement('b'); b.textContent = e.nome;
      var s = document.createElement('small');
      var usados = estado.lotes.filter(function (l) { return l.espId === e.id })
        .reduce(function (a, l) { return a + l.nomes.length }, 0);
      s.textContent = e.cor.toUpperCase() + (usados ? ' · ' + usados + ' certificado' + (usados > 1 ? 's' : '') : '');
      meio.appendChild(b); meio.appendChild(s);

      var acoes = document.createElement('div');
      acoes.className = 'cartao-acoes';
      var ed = document.createElement('button');
      ed.className = 'icone-bt'; ed.title = 'Editar'; ed.textContent = '✎';
      ed.onclick = function () { editarEsp(e.id) };
      var rm = document.createElement('button');
      rm.className = 'icone-bt del'; rm.title = 'Remover'; rm.textContent = '✕';
      rm.onclick = function () { removerEsp(e.id) };
      acoes.appendChild(ed); acoes.appendChild(rm);

      li.appendChild(mini); li.appendChild(bol); li.appendChild(meio); li.appendChild(acoes);
      ul.appendChild(li);
    });
    recolher(ul, 'esp', 3, 'especialidades');

    pintarCombo();
  }

  function editarEsp (i) {
    var e = espPorId(i);
    if (!e) return;
    editandoEsp = i;
    id('esp-nome').value = e.nome;
    id('esp-cor').value = e.cor;
    marcarCor(e.cor);
    mostrarSoltar(null, e.imgId);
    id('bt-salvar-esp').textContent = 'Salvar alteração';
    id('bt-cancelar-esp').hidden = false;
    id('p-especialidades').scrollIntoView({ block: 'start' });
  }

  function limparFormEsp () {
    editandoEsp = null; imgPendente = null;
    id('form-esp').reset();
    marcarCor('#08A008');
    mostrarSoltar(null, null);
    id('bt-salvar-esp').textContent = 'Adicionar especialidade';
    id('bt-cancelar-esp').hidden = true;
  }

  function removerEsp (i, ok) {
    var usada = estado.lotes.some(function (l) { return l.espId === i });
    var e = espPorId(i);
    if (!ok) return perguntar('Excluir especialidade?',
      '"' + (e ? e.nome : '') + '" será excluída' + (usada ? ', junto com os lotes que usam ela.' : '.') + ' Isso não pode ser desfeito.',
      'Excluir', function () { removerEsp(i, true) }, 'esp');
    if (e && e.imgId) { apagarImg(e.imgId); delete cacheImg[e.imgId] }
    estado.especialidades = estado.especialidades.filter(function (x) { return x.id !== i });
    estado.lotes = estado.lotes.filter(function (l) { return l.espId !== i });
    salvar(); pintarTudo();
    aviso('Especialidade removida.');
  }

  id('form-esp').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nome = id('esp-nome').value.trim();
    var cor = id('esp-cor').value;
    if (!nome) return;

    var tarefa = Promise.resolve(null);
    if (imgPendente) {
      var novo = novoId();
      tarefa = guardarImg(novo, imgPendente).then(function () { return novo });
    }

    tarefa.then(function (imgId) {
      if (editandoEsp) {
        var e = espPorId(editandoEsp);
        e.nome = nome; e.cor = cor;
        if (imgId) { if (e.imgId) apagarImg(e.imgId); e.imgId = imgId }
        aviso('Especialidade atualizada.');
      } else {
        var iguais = estado.especialidades.some(function (x) {
          return x.nome.toLowerCase() === nome.toLowerCase();
        });
        if (iguais) { aviso('Já existe uma especialidade com esse nome.', true); return }
        estado.especialidades.push({ id: novoId(), nome: nome, cor: cor, imgId: imgId });
        aviso('Especialidade adicionada.');
      }
      salvar(); limparFormEsp(); pintarTudo();
    });
  });

  id('bt-cancelar-esp').addEventListener('click', limparFormEsp);

  function marcarCor (cor) {
    id('esp-cor').value = cor;
    var achou = false;
    $$('#cores .cor[data-cor]').forEach(function (b) {
      var on = b.dataset.cor.toLowerCase() === cor.toLowerCase();
      if (on) achou = true;
      b.classList.toggle('on', on);
    });
    var livre = $('.cor-livre');
    livre.classList.toggle('on', !achou);
    livre.style.setProperty('--c', achou ? 'transparent' : cor);
  }
  $$('#cores .cor[data-cor]').forEach(function (b) {
    b.addEventListener('click', function () { marcarCor(b.dataset.cor) });
  });
  /* painel de cor próprio: tom, intensidade e claridade, mais o código */
  function hslHex (h, sat, l) {
    sat /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12 };
    var a = sat * Math.min(l, 1 - l);
    var c = function (n) {
      var v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return ('#' + c(0) + c(8) + c(4)).toUpperCase();
  }
  var painel = id('painel-cor'), corPainel = '#08A008';
  function atualizarPainel () {
    corPainel = hslHex(+id('pc-tom').value, +id('pc-sat').value, +id('pc-luz').value);
    id('pc-amostra').style.background = corPainel;
    id('pc-hex').value = corPainel;
    painel.style.setProperty('--tom', id('pc-tom').value);
  }
  ['pc-tom', 'pc-sat', 'pc-luz'].forEach(function (k) { id(k).addEventListener('input', atualizarPainel) });
  id('pc-hex').addEventListener('input', function () {
    var v = this.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { corPainel = v.toUpperCase(); id('pc-amostra').style.background = v }
  });
  id('abrir-cor').addEventListener('click', function (e) {
    e.stopPropagation();
    var abrir = painel.hidden;
    painel.hidden = !abrir;
    this.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) atualizarPainel();
  });
  id('pc-ok').addEventListener('click', function () {
    marcarCor(corPainel); painel.hidden = true;
    id('abrir-cor').setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', function (e) {
    if (!painel.hidden && !painel.contains(e.target)) painel.hidden = true;
  });

  function mostrarSoltar (url, imgId) {
    var pv = id('soltar-prev'), cx = id('soltar-esp');
    function poe (u) { pv.src = u; pv.hidden = false; cx.classList.add('cheio') }
    pv.hidden = true; cx.classList.remove('cheio');
    if (url) poe(url);
    else if (imgId) imagemDe(imgId).then(function (im) { if (im) poe(im.src) });
  }
  function receberBotao (f) {
    if (!f) return;
    prepararImagem(f, 520).then(function (url) {
      imgPendente = url; mostrarSoltar(url);
    }).catch(function () { aviso('Não consegui ler essa imagem.', true) });
  }
  id('esp-img').addEventListener('change', function () { receberBotao(this.files && this.files[0]) });
  var zona = id('soltar-esp');
  ['dragenter', 'dragover'].forEach(function (t) {
    zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.add('sobre') });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.remove('sobre') });
  });
  zona.addEventListener('drop', function (e) { receberBotao(e.dataTransfer.files[0]) });

  /* logotipo global */
  id('logo-img').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    prepararImagem(f, 420).then(function (url) {
      return guardarImg('logo', url);
    }).then(function () {
      estado.temLogo = true; delete cacheImg.logo;
      salvar(); pintarPrevia();
      aviso('Logotipo salvo. Vale para todos os certificados.');
    }).catch(function () { aviso('Não consegui ler esse logotipo.', true) });
  });

  id('bt-logo-padrao').addEventListener('click', function () {
    apagarImg('logo'); delete cacheImg.logo;
    estado.temLogo = false; salvar(); pintarPrevia();
    aviso('Voltou para a logo oficial.');
  });

  /* ═══════════ interface: lotes ═══════════ */

  $$('.aba').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.aba').forEach(function (o) {
        var on = o === b;
        o.classList.toggle('on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      id('painel-manual').hidden = b.dataset.aba !== 'manual';
      id('painel-massa').hidden = b.dataset.aba !== 'massa';
    });
  });

  function nomesDoTexto (txt) {
    return (txt || '').split(/\r?\n/).map(function (s) { return s.trim() })
      .filter(function (s) { return s.length > 0 });
  }

  id('lote-nomes').addEventListener('input', function () {
    var n = nomesDoTexto(this.value).length;
    id('conta-nomes').textContent = n + (n === 1 ? ' nome' : ' nomes');
  });

  $$('input[name=tipo-data]').forEach(function (r) {
    r.addEventListener('change', function () {
      var t = $('input[name=tipo-data]:checked').value;
      id('data-dia').disabled = t !== 'cheia';
      id('data-mes').disabled = t !== 'cheia';
      id('data-ano').disabled = t === 'branco';
      id('data-dica').hidden = t !== 'branco';
      if (t === 'ano' && !id('data-ano').value) id('data-ano').value = new Date().getFullYear();
    });
  });

  id('form-lote').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nomeEsp = id('lote-esp').value.trim();
    if (!nomeEsp) { aviso('Escreva a especialidade.', true); return }
    var esp = estado.especialidades.filter(function (x) {
      return x.nome.toLowerCase() === nomeEsp.toLowerCase();
    })[0];
    if (!esp) {
      esp = { id: novoId(), nome: nomeEsp, cor: '#08A008', imgId: null };
      estado.especialidades.push(esp);
    }
    var espId = esp.id;
    var nomes = nomesDoTexto(id('lote-nomes').value);
    if (!nomes.length) { aviso('Coloque ao menos um nome.', true); return }

    estado.lotes.push({
      id: novoId(), espId: espId, nomes: nomes,
      tipoData: $('input[name=tipo-data]:checked').value,
      dia: id('data-dia').value.trim(),
      mes: id('data-mes').value.trim(),
      ano: id('data-ano').value.trim(),
    });
    salvar();
    id('lote-nomes').value = '';
    id('lote-esp').value = '';
    id('conta-nomes').textContent = '0 nomes';
    pintarTudo();
    aviso(nomes.length + ' certificado' + (nomes.length > 1 ? 's adicionados' : ' adicionado') + ' ao lote.');
  });

  function pintarLotes () {
    var ul = id('lista-lotes');
    ul.innerHTML = '';
    id('lotes-vazio').hidden = estado.lotes.length > 0;

    estado.lotes.forEach(function (l) {
      var e = espPorId(l.espId);
      var li = document.createElement('li');
      li.className = 'cartao-lote';

      var bol = document.createElement('span');
      bol.className = 'bolinha'; bol.style.background = e ? e.cor : '#ccc';

      var meio = document.createElement('div');
      meio.className = 'meio';
      var b = document.createElement('b');
      b.textContent = e ? e.nome : '(especialidade removida)';
      var s = document.createElement('small');
      s.textContent = l.nomes.length + ' desbravador' + (l.nomes.length > 1 ? 'es' : '');
      var dt = document.createElement('small');
      dt.className = 'lote-data';
      dt.textContent = l.tipoData === 'branco' ? 'Data em branco' : 'Data: ' + textoData(l);
      meio.appendChild(b); meio.appendChild(s); meio.appendChild(dt);

      var tag = document.createElement('span');
      if (e && !e.imgId) { tag.className = 'etiqueta falta'; tag.textContent = 'sem boton' }
      else { tag.className = 'etiqueta'; tag.textContent = 'pronto' }

      var acoes = document.createElement('div');
      acoes.className = 'cartao-acoes';
      var rm = document.createElement('button');
      rm.className = 'icone-bt del'; rm.title = 'Remover lote'; rm.textContent = '✕';
      rm.onclick = function () {
        perguntar('Excluir lote?',
          'O lote de "' + (e ? e.nome : 'especialidade removida') + '" com ' + l.nomes.length + ' desbravador' + (l.nomes.length > 1 ? 'es' : '') + ' será excluído. Isso não pode ser desfeito.',
          'Excluir', function () {
            estado.lotes = estado.lotes.filter(function (x) { return x.id !== l.id });
            salvar(); pintarTudo(); aviso('Lote removido.');
          }, 'lote');
      };
      acoes.appendChild(rm);

      b.appendChild(tag);
      li.appendChild(bol); li.appendChild(meio); li.appendChild(acoes);
      ul.appendChild(li);
    });
    recolher(ul, 'lotes', 3, 'lotes');
  }

  /* ═══════════ importação em massa ═══════════ */

  function lerLinhas (txt) {
    return (txt || '').split(/\r?\n/).map(function (linha) {
      var l = linha.trim();
      if (!l) return null;
      var partes = l.split(/\t|;|,/);
      if (partes.length < 2) return null;
      var esp = partes[0].trim();
      var nome = partes.slice(1).join(' ').trim();
      if (!esp || !nome) return null;
      return { esp: esp, nome: nome };
    }).filter(Boolean);
  }

  id('massa-txt').addEventListener('input', function () {
    var n = lerLinhas(this.value).length;
    id('conta-massa').textContent = n + (n === 1 ? ' linha válida' : ' linhas válidas');
  });

  id('massa-csv').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      id('massa-txt').value = r.result;
      id('massa-txt').dispatchEvent(new Event('input'));
      aviso('Arquivo carregado. Confira e clique em Criar lotes.');
    };
    r.readAsText(f, 'utf-8');
  });

  id('bt-massa').addEventListener('click', function () {
    var linhas = lerLinhas(id('massa-txt').value);
    if (!linhas.length) {
      aviso('Não encontrei linhas no formato Especialidade ; Nome.', true);
      return;
    }

    var porEsp = {}, criadas = 0, repetidos = [];
    var vistos = {};

    linhas.forEach(function (it) {
      var chave = it.esp.toLowerCase();
      var dupChave = chave + '|' + it.nome.toLowerCase();
      if (vistos[dupChave]) { repetidos.push(it.esp + ' · ' + it.nome); return }
      vistos[dupChave] = true;
      (porEsp[chave] = porEsp[chave] || { nome: it.esp, nomes: [] }).nomes.push(it.nome);
    });

    var tipoData = $('input[name=tipo-data]:checked').value;
    var dia = id('data-dia').value.trim(), mes = id('data-mes').value.trim(), ano = id('data-ano').value.trim();

    Object.keys(porEsp).forEach(function (chave) {
      var g = porEsp[chave];
      var e = estado.especialidades.filter(function (x) {
        return x.nome.toLowerCase() === chave;
      })[0];
      if (!e) {
        e = { id: novoId(), nome: g.nome, cor: '#08A008', imgId: null };
        estado.especialidades.push(e);
        criadas++;
      }
      estado.lotes.push({
        id: novoId(), espId: e.id, nomes: g.nomes,
        tipoData: tipoData, dia: dia, mes: mes, ano: ano,
      });
    });

    salvar(); pintarTudo();

    var cx = id('resumo-massa');
    cx.hidden = false;
    cx.innerHTML = '<b>' + linhas.length + '</b> linhas lidas · <b>' +
      Object.keys(porEsp).length + '</b> especialidades · <b>' + criadas +
      '</b> criadas agora' +
      (repetidos.length ? ' · <b>' + repetidos.length + '</b> repetidos ignorados' : '') +
      (criadas ? '<br>Defina a cor e o boton das novas especialidades no passo 1.' : '');

    id('massa-txt').value = '';
    id('conta-massa').textContent = '0 linhas válidas';
    aviso('Lotes criados.');
  });

  /* ═══════════ menu de especialidades ═══════════ */

  var combo = id('lote-esp'), lista = id('combo-lista'), marcado = -1;
  function pintarCombo () {
    if (!lista) return;
    var q = combo.value.trim().toLowerCase();
    var achadas = estado.especialidades.filter(function (e) { return e.nome.toLowerCase().indexOf(q) > -1 });
    lista.innerHTML = '';
    achadas.forEach(function (e, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = i === marcado ? 'on' : '';
      li.innerHTML = '<span class="bolinha" style="background:' + e.cor + '"></span>';
      li.appendChild(document.createTextNode(e.nome));
      li.addEventListener('mousedown', function (ev) { ev.preventDefault(); escolher(e.nome) });
      lista.appendChild(li);
    });
    var existe = estado.especialidades.some(function (e) { return e.nome.toLowerCase() === q });
    if (q && !existe) {
      var nova = document.createElement('li');
      nova.className = 'nova';
      nova.textContent = '+ Criar "' + combo.value.trim() + '"';
      nova.addEventListener('mousedown', function (ev) { ev.preventDefault(); fecharCombo() });
      lista.appendChild(nova);
    }
    if (!lista.children.length) {
      var v = document.createElement('li');
      v.className = 'vazia';
      v.textContent = 'Nenhuma especialidade cadastrada. Digite o nome.';
      lista.appendChild(v);
    }
  }
  function abrirCombo () { pintarCombo(); lista.hidden = false; combo.setAttribute('aria-expanded', 'true') }
  function fecharCombo () { lista.hidden = true; marcado = -1; combo.setAttribute('aria-expanded', 'false') }
  function escolher (nome) { combo.value = nome; fecharCombo() }
  combo.addEventListener('focus', abrirCombo);
  combo.addEventListener('input', function () { marcado = -1; abrirCombo() });
  combo.addEventListener('blur', function () { setTimeout(fecharCombo, 120) });
  combo.addEventListener('keydown', function (e) {
    var itens = [].slice.call(lista.querySelectorAll('li[role=option]'));
    if (e.key === 'ArrowDown') { e.preventDefault(); marcado = Math.min(itens.length - 1, marcado + 1); pintarCombo(); lista.hidden = false }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcado = Math.max(0, marcado - 1); pintarCombo() }
    else if (e.key === 'Enter' && marcado > -1 && itens[marcado]) { e.preventDefault(); escolher(itens[marcado].textContent) }
    else if (e.key === 'Escape') fecharCombo();
  });

  /* ═══════════ prévia ═══════════ */

  function pintarSeletorPrevia () {
    var sel = id('previa-lote');
    var antes = sel.value;
    sel.innerHTML = '';
    estado.lotes.forEach(function (l) {
      var e = espPorId(l.espId);
      var o = document.createElement('option');
      o.value = l.id;
      o.textContent = (e ? e.nome : '—') + ' · ' + l.nomes[0] +
        (l.nomes.length > 1 ? ' (+' + (l.nomes.length - 1) + ')' : '');
      sel.appendChild(o);
    });
    if (antes) sel.value = antes;
    if (!sel.value && estado.lotes.length) sel.value = estado.lotes[0].id;
    $('.previa-barra').hidden = !estado.lotes.length;
    var chips = id('chips-lote');
    chips.innerHTML = '';
    estado.lotes.forEach(function (l) {
      var e = espPorId(l.espId);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-lote' + (l.id === sel.value ? ' on' : '');
      b.innerHTML = '<span class="bolinha" style="background:' + (e ? e.cor : '#ccc') + '"></span>';
      b.appendChild(document.createTextNode((e ? e.nome : '—') + ' · ' + l.nomes[0].split(' ')[0] + (l.nomes.length > 1 ? ' +' + (l.nomes.length - 1) : '')));
      b.addEventListener('click', function () {
        sel.value = l.id; sel.dispatchEvent(new Event('change'));
        $$('.chip-lote').forEach(function (o) { o.classList.toggle('on', o === b) });
      });
      chips.appendChild(b);
    });
    recolher(chips, 'chips', 4, 'lotes');
  }

  function loteDaPrevia () {
    var i = id('previa-lote').value;
    for (var k = 0; k < estado.lotes.length; k++) if (estado.lotes[k].id === i) return estado.lotes[k];
    return estado.lotes[0] || null;
  }

  function pintarPrevia () {
    var cv = id('previa');
    var altPrevia = Math.round(cv.width / proporcao());
    if (cv.height !== altPrevia) cv.height = altPrevia;
    var ctx = cv.getContext('2d');
    var l = loteDaPrevia();

    if (!l) {
      desenharAtual(ctx, cv.width, cv.height, {
        cor: '#08A008', especialidade: 'Ecologia', nome: 'Miguel Félix',
        data: '___ / ___ / 2026', botao: null, logo: cacheImg.logo || null,
      });
      return;
    }
    var e = espPorId(l.espId);
    Promise.all([
      imagemDe(e ? e.imgId : null),
      estado.temLogo ? imagemDe('logo') : Promise.resolve(null),
    ]).then(function (r) {
      desenharAtual(ctx, cv.width, cv.height, {
        cor: e ? e.cor : '#08A008',
        especialidade: e ? e.nome : '',
        nome: l.nomes[0],
        data: textoData(l),
        botao: r[0], logo: r[1],
      });
    });
  }

  id('previa-lote').addEventListener('change', pintarPrevia);

  function ampliar () {
    id('zoom-img').src = id('previa').toDataURL('image/png');
    id('zoom').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function fecharZoom () { id('zoom').hidden = true; document.body.style.overflow = '' }
  id('previa-moldura').addEventListener('click', ampliar);
  id('previa-moldura').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ampliar() } });
  id('zoom').addEventListener('click', function (e) { if (e.target.id !== 'zoom-img') fecharZoom() });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharZoom() });

  id('bt-png-um').addEventListener('click', function () {
    var cv = id('previa');
    var l = loteDaPrevia();
    var e = l ? espPorId(l.espId) : null;
    cv.toBlob(function (b) {
      baixar(b, limpaNome((e ? e.nome : 'certificado') + ' - ' + (l ? l.nomes[0] : 'exemplo')) + '.png');
    }, 'image/png');
  });

  /* ═══════════ geração ═══════════ */

  var QUALIDADE = { alta: { w: 2480, q: 0.95 }, boa: { w: 1800, q: 0.88 }, leve: { w: 1200, q: 0.80 } };
  var cancelar = false;

  function baixar (blob, nome) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 1500);
  }

  function mostrarProgresso (on) {
    id('progresso').hidden = !on;
    id('bt-pdf').disabled = on;
    id('bt-zip').disabled = on;
  }
  function progresso (feito, total, txt) {
    id('barra-fill').style.width = Math.round((feito / total) * 100) + '%';
    id('progresso-txt').textContent = txt || (feito + ' de ' + total);
  }
  var respirar = function () { return new Promise(function (r) { setTimeout(r, 0) }) };

  /* desenha um certificado e devolve o dataURL */
  function render (cv, ctx, item, logo, botao, formato, q) {
    desenharAtual(ctx, cv.width, cv.height, {
      cor: item.cor, especialidade: item.especialidade,
      nome: item.nome, data: item.data, botao: botao, logo: logo,
    });
    return cv.toDataURL(formato, q);
  }

  /* layout das páginas do PDF, em milímetros */
  var LAYOUTS = {
    '1': { orient: 'landscape', fmt: 'a4', larg: 265, margemX: 16, topo: 56, gap: 0 },
    '2': { orient: 'landscape', fmt: 'a4', larg: 235, margemX: 31, topo: 11, gap: 10 },
    '3': { orient: 'portrait', fmt: 'a4', larg: 186, margemX: 12, topo: 22, gap: 12 },
  };
  /* modelo moderno (A4): página inteira deitada, ou dois em pé */
  var LAYOUTS_MODERNO = {
    '1': { orient: 'landscape', fmt: 'a4', larg: 277, margemX: 10, topo: 10, gap: 0 },
    '2': { orient: 'portrait', fmt: 'a4', larg: 190, margemX: 10, topo: 10, gap: 8 },
  };

  function gerarPdf () {
    if (!window.jspdf || !window.JSZip) { aviso('Não carregou o gerador de PDF. Recarregue a página.', true); return }
    var itens = todosOsCertificados();
    if (!itens.length) { aviso('Não há certificados para gerar.', true); return }

    var conf = QUALIDADE[id('qualidade').value];
    var porPagina = id('por-pagina').value;
    if (moderno() && porPagina === '3') porPagina = '2';
    var lay = (moderno() ? LAYOUTS_MODERNO : LAYOUTS)[porPagina];
    var separar = id('separar').value;

    var cv = document.createElement('canvas');
    cv.width = conf.w; cv.height = Math.round(conf.w / proporcao());
    var ctx = cv.getContext('2d');

    var grupos = {};
    if (separar === 'especialidade') {
      itens.forEach(function (it) { (grupos[it.especialidade] = grupos[it.especialidade] || []).push(it) });
    } else {
      grupos['Certificados'] = itens;
    }

    cancelar = false;
    mostrarProgresso(true);
    progresso(0, itens.length, 'Preparando…');

    var feitos = 0;
    var nomes = Object.keys(grupos);
    var pdfs = [];

    var logoP = estado.temLogo ? imagemDe('logo') : Promise.resolve(null);

    logoP.then(function (logo) {
      var cadeia = Promise.resolve();

      nomes.forEach(function (g) {
        cadeia = cadeia.then(function () {
          if (cancelar) return;
          var doc = new window.jspdf.jsPDF({ orientation: lay.orient, unit: 'mm', format: lay.fmt });
          var altCert = lay.larg / proporcao();
          var porPag = parseInt(porPagina, 10);
          var lista = grupos[g];
          var passo = Promise.resolve();

          lista.forEach(function (it, i) {
            passo = passo.then(function () {
              if (cancelar) return;
              return imagemDe(it.imgId).then(function (botao) {
                var pos = i % porPag;
                if (i > 0 && pos === 0) doc.addPage();
                var y = lay.topo + pos * (altCert + lay.gap);
                var url = render(cv, ctx, it, logo, botao, 'image/jpeg', conf.q);
                doc.addImage(url, 'JPEG', lay.margemX, y, lay.larg, altCert, undefined, 'FAST');
                feitos++;
                if (feitos % 4 === 0 || feitos === itens.length) {
                  progresso(feitos, itens.length, 'Desenhando ' + feitos + ' de ' + itens.length + '…');
                  return respirar();
                }
              });
            });
          });

          return passo.then(function () {
            if (cancelar) return;
            pdfs.push({ nome: limpaNome(g) + '.pdf', blob: doc.output('blob') });
          });
        });
      });

      return cadeia;
    }).then(function () {
      if (cancelar) { mostrarProgresso(false); aviso('Geração cancelada.'); return }
      if (pdfs.length === 1) {
        baixar(pdfs[0].blob, pdfs[0].nome);
        mostrarProgresso(false);
        aviso(itens.length + ' certificados no PDF.');
        return;
      }
      progresso(1, 1, 'Compactando os PDFs…');
      var zip = new window.JSZip();
      pdfs.forEach(function (p) { zip.file(p.nome, p.blob) });
      return zip.generateAsync({ type: 'blob' }).then(function (b) {
        baixar(b, 'Certificados por especialidade.zip');
        mostrarProgresso(false);
        aviso(pdfs.length + ' PDFs, ' + itens.length + ' certificados.');
      });
    }).catch(function (e) {
      mostrarProgresso(false);
      aviso('Falhou ao gerar: ' + e.message, true);
    });
  }

  function gerarZip (ok) {
    if (!window.JSZip) { aviso('Não carregou o gerador de ZIP. Recarregue a página.', true); return }
    var itens = todosOsCertificados();
    if (!itens.length) { aviso('Não há certificados para gerar.', true); return }
    if (itens.length > 250 && ok !== true) return perguntar('Arquivo grande', itens.length + ' imagens PNG dão um arquivo pesado e podem travar o navegador. Em geral o PDF resolve melhor.', 'Gerar mesmo assim', function () { gerarZip(true) });

    var conf = QUALIDADE[id('qualidade').value];
    var cv = document.createElement('canvas');
    cv.width = conf.w; cv.height = Math.round(conf.w / proporcao());
    var ctx = cv.getContext('2d');

    cancelar = false;
    mostrarProgresso(true);
    progresso(0, itens.length, 'Preparando…');

    var zip = new window.JSZip();
    var feitos = 0;
    var usados = {};

    (estado.temLogo ? imagemDe('logo') : Promise.resolve(null)).then(function (logo) {
      var cadeia = Promise.resolve();
      itens.forEach(function (it) {
        cadeia = cadeia.then(function () {
          if (cancelar) return;
          return imagemDe(it.imgId).then(function (botao) {
            var url = render(cv, ctx, it, logo, botao, 'image/png');
            var base = limpaNome(it.especialidade + ' - ' + it.nome);
            usados[base] = (usados[base] || 0) + 1;
            var nome = base + (usados[base] > 1 ? ' (' + usados[base] + ')' : '') + '.png';
            zip.folder(limpaNome(it.especialidade)).file(nome, url.split(',')[1], { base64: true });
            feitos++;
            if (feitos % 3 === 0 || feitos === itens.length) {
              progresso(feitos, itens.length, 'Desenhando ' + feitos + ' de ' + itens.length + '…');
              return respirar();
            }
          });
        });
      });
      return cadeia;
    }).then(function () {
      if (cancelar) { mostrarProgresso(false); aviso('Geração cancelada.'); return }
      progresso(1, 1, 'Compactando…');
      return zip.generateAsync({ type: 'blob' }).then(function (b) {
        baixar(b, 'Certificados em PNG.zip');
        mostrarProgresso(false);
        aviso(itens.length + ' imagens no ZIP.');
      });
    }).catch(function (e) {
      mostrarProgresso(false);
      aviso('Falhou ao gerar: ' + e.message, true);
    });
  }

  id('bt-pdf').addEventListener('click', gerarPdf);
  id('bt-zip').addEventListener('click', gerarZip);
  id('bt-cancelar').addEventListener('click', function () { cancelar = true });
  id('bt-gerar-topo').addEventListener('click', function () {
    id('p-gerar').scrollIntoView({ block: 'start' });
  });

  /* ═══════════ backup ═══════════ */

  id('bt-backup').addEventListener('click', function () {
    var p = lerPref();
    id('mb-reativar').hidden = !(p.lote || p.esp);
    id('modal-backup').hidden = false;
  });
  function fecharBackup () { id('modal-backup').hidden = true }
  id('mb-x').addEventListener('click', fecharBackup);
  id('modal-backup').addEventListener('click', function (e) { if (e.target === this) fecharBackup() });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharBackup() });
  id('mb-reativar').addEventListener('click', function () {
    try { localStorage.removeItem(CHAVE_PREF) } catch (e) {}
    this.hidden = true;
    aviso('Pronto. A confirmação antes de excluir voltou.');
  });
  id('mb-restaurar').addEventListener('click', function () { fecharBackup(); id('restaurar').click() });
  id('mb-baixar').addEventListener('click', function () {
    fecharBackup();
    {
      var imgs = {};
      var ids = estado.especialidades.map(function (e) { return e.imgId }).filter(Boolean);
      if (estado.temLogo) ids.push('logo');
      Promise.all(ids.map(function (i) {
        return lerImg(i).then(function (u) { if (u) imgs[i] = u });
      })).then(function () {
        var pacote = JSON.stringify({ estado: estado, imagens: imgs });
        baixar(new Blob([pacote], { type: 'application/json' }),
          'backup-certificados-' + new Date().toISOString().slice(0, 10) + '.json');
        aviso('Backup baixado.');
      });
    }
  });

  id('restaurar').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var p = JSON.parse(r.result);
        if (!p.estado) throw new Error('arquivo fora do formato');
        var imgs = p.imagens || {};
        Promise.all(Object.keys(imgs).map(function (i) { return guardarImg(i, imgs[i]) }))
          .then(function () {
            estado = sanear(p.estado);
            cacheImg = {};
            salvar(); pintarTudo();
            aviso('Backup restaurado.');
          });
      } catch (e) { aviso('Arquivo de backup inválido.', true) }
    };
    r.readAsText(f, 'utf-8');
  });

  /* ═══════════ janela de confirmação ═══════════ */

  var aoConfirmar = null;
  /* "não perguntar novamente" fica guardado por tipo de pergunta */
  var CHAVE_PREF = 'desbravadores-nao-perguntar';
  function lerPref () { try { return JSON.parse(localStorage.getItem(CHAVE_PREF)) || {} } catch (e) { return {} } }
  function gravarPref (k) { try { var p = lerPref(); p[k] = true; localStorage.setItem(CHAVE_PREF, JSON.stringify(p)) } catch (e) {} }
  var chaveConf = null;
  function perguntar (titulo, texto, rotulo, fn, chave) {
    if (chave && lerPref()[chave]) return fn();
    id('mc-tit').textContent = titulo; id('mc-txt').textContent = texto; id('mc-ok').textContent = rotulo;
    chaveConf = chave || null;
    id('mc-ok').classList.toggle('perigo', rotulo === 'Excluir');
    id('mc-lembrar').hidden = !chave; id('mc-nao-mais').checked = false;
    aoConfirmar = fn; id('modal-conf').hidden = false; id('mc-ok').focus();
  }
  function fecharConf () { id('modal-conf').hidden = true; aoConfirmar = null }
  id('mc-nao').addEventListener('click', fecharConf);
  id('modal-conf').addEventListener('click', function (e) { if (e.target === this) fecharConf() });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharConf() });
  id('mc-ok').addEventListener('click', function () {
    if (chaveConf && id('mc-nao-mais').checked) gravarPref(chaveConf);
    var f = aoConfirmar; fecharConf(); if (f) f();
  });

  /* ═══════════ opções em cartões no lugar das listas nativas ═══════════ */

  id('modelo').value = estado.modelo;
  ['modelo', 'por-pagina', 'qualidade', 'separar'].forEach(function (k) {
    var sel = id(k);
    if (!sel) return;
    var grade = document.createElement('div');
    grade.className = 'opcoes opcoes-' + sel.options.length;
    grade.setAttribute('role', 'radiogroup');
    [].forEach.call(sel.options, function (o) {
      var partes = o.textContent.split(/ — | \(/);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcao';
      b.setAttribute('role', 'radio');
      b.innerHTML = '<b></b><small></small>';
      b.firstChild.textContent = o.dataset.t || partes[0];
      b.lastChild.textContent = o.dataset.s || (partes[1] || '').replace(/\)$/, '');
      b.addEventListener('click', function () { sel.value = o.value; sel.dispatchEvent(new Event('change')); marcar() });
      b.dataset.v = o.value;
      grade.appendChild(b);
    });
    function marcar () {
      [].forEach.call(grade.children, function (b) {
        var on = b.dataset.v === sel.value;
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
      });
    }
    sel.hidden = true;
    sel.parentNode.insertBefore(grade, sel.nextSibling);
    marcar();
  });

  /* modelo escolhido: ajusta as opções de folha e redesenha */
  function ajustarFolhas () {
    var m = moderno();
    var grade = id('por-pagina').nextElementSibling;
    if (!grade) return;
    [].forEach.call(grade.children, function (b) {
      if (b.dataset.v === '3') b.hidden = m;
      if (b.dataset.v === '2') b.lastChild.textContent = m ? 'A4 em pé' : 'A4 deitada';
    });
    grade.className = 'opcoes opcoes-' + (m ? 2 : 3);
    if (m && id('por-pagina').value === '3') { id('por-pagina').value = '2'; id('por-pagina').dispatchEvent(new Event('change')) }
    [].forEach.call(grade.children, function (b) { b.classList.toggle('on', b.dataset.v === id('por-pagina').value) });
  }
  id('modelo').addEventListener('change', function () {
    estado.modelo = ['classico', 'compacto', 'moderno'].indexOf(this.value) > -1 ? this.value : 'classico';
    salvar(); ajustarFolhas(); pintarPrevia();
  });
  ajustarFolhas();
  if (window.emblemaModerno) window.emblemaModerno.addEventListener('load', function () { pintarPrevia() });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { pintarPrevia() });

  /* ═══════════ pintura geral ═══════════ */

  var placarAberto = false;
  function pintarPlacar () {
    var total = totalCertificados();
    id('placar').textContent = total + (total === 1 ? ' certificado' : ' certificados');

    var porEsp = {};
    estado.lotes.forEach(function (l) {
      var e = espPorId(l.espId);
      var n = e ? e.nome : '(sem especialidade)';
      porEsp[n] = (porEsp[n] || 0) + l.nomes.length;
    });

    var ul = id('placar-lista');
    ul.innerHTML = '';
    var nomes = Object.keys(porEsp).sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }) });
    if (!total) return;
    var topo = document.createElement('li');
    topo.className = 'placar-total';
    topo.innerHTML = '<span><b>Total</b> · ' + nomes.length + (nomes.length === 1 ? ' especialidade' : ' especialidades') + '</span><b>' + total + '</b>';
    ul.appendChild(topo);
    var poucos = nomes.length <= 4;
    nomes.forEach(function (n) {
      var li = document.createElement('li');
      li.className = 'placar-item';
      li.hidden = !poucos && !placarAberto;
      li.innerHTML = '<span>' + n.replace(/</g, '&lt;') + '</span><b>' + porEsp[n] + '</b>';
      ul.appendChild(li);
    });
    if (!poucos) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'placar-ver';
      bt.textContent = placarAberto ? 'Esconder detalhes' : 'Ver por especialidade';
      bt.addEventListener('click', function () { placarAberto = !placarAberto; pintarPlacar() });
      var li3 = document.createElement('li');
      li3.appendChild(bt);
      ul.appendChild(li3);
    }
  }

  function pintarTudo () {
    pintarEspecialidades();
    pintarLotes();
    pintarSeletorPrevia();
    pintarPlacar();
    pintarPrevia();
  }

  /* ═══════════ erros inesperados ═══════════ */

  window.addEventListener('error', function () {
    aviso('Algo deu errado. Recarregue a página; seus dados continuam salvos.', true);
  });
  window.addEventListener('unhandledrejection', function () {
    aviso('Algo deu errado. Recarregue a página; seus dados continuam salvos.', true);
  });

  /* ═══════════ início ═══════════ */

  carregar();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(pintarTudo);
  }
  pintarTudo();
})();
