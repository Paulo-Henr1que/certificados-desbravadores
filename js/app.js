/* Gerador de Certificados · Clube de Desbravadores
   Tudo roda no navegador. Nada é enviado para servidor.
   Os textos e lotes ficam no localStorage; as imagens, no IndexedDB
   (localStorage estoura com poucos botões de especialidade). */
(function () {
  'use strict';

  /* ═══════════ guarda de dados ═══════════ */

  var CHAVE = 'desbravadores-certificados-v1';
  var estado = { especialidades: [], lotes: [], temLogo: false };

  function salvar () {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)) }
    catch (e) { aviso('Não deu para salvar neste navegador. Faça um backup.', true) }
  }
  function carregar () {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) estado = Object.assign(estado, JSON.parse(cru));
    } catch (e) { /* começa limpo */ }
  }

  /* IndexedDB só para as imagens */
  var bd = null;
  function abrirBd () {
    return new Promise(function (ok, erro) {
      if (bd) return ok(bd);
      var req = indexedDB.open('desbravadores-img', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('img') };
      req.onsuccess = function () { bd = req.result; ok(bd) };
      req.onerror = function () { erro(req.error) };
    });
  }
  function guardarImg (id, dataUrl) {
    return abrirBd().then(function (b) {
      return new Promise(function (ok, erro) {
        var t = b.transaction('img', 'readwrite');
        t.objectStore('img').put(dataUrl, id);
        t.oncomplete = ok; t.onerror = function () { erro(t.error) };
      });
    });
  }
  function lerImg (id) {
    return abrirBd().then(function (b) {
      return new Promise(function (ok) {
        var r = b.transaction('img', 'readonly').objectStore('img').get(id);
        r.onsuccess = function () { ok(r.result || null) };
        r.onerror = function () { ok(null) };
      });
    });
  }
  function apagarImg (id) {
    return abrirBd().then(function (b) {
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

  function novoId () { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

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

  /* reduz a imagem enviada: 700 certificados com botões grandes
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
      Math.round(0.118 * H), '700', tinta, 'center', 0.50 * W);

    // desbravador
    var rotulo = 'Desbravador: ';
    var tamNome = Math.round(0.098 * H);
    ctx.font = '400 ' + tamNome + 'px "Open Sans", Calibri, Arial, sans-serif';
    var larguraRot = ctx.measureText(rotulo).width;
    var xNome = 0.135 * W;
    texto(ctx, rotulo, xNome, 0.630 * H, tamNome, '400', tinta, 'left');
    texto(ctx, d.nome || '', xNome + larguraRot, 0.630 * H,
      tamNome, '400', tinta, 'left', limite - (xNome + larguraRot));

    // data
    texto(ctx, d.data || '', 0.148 * W, 0.772 * H,
      Math.round(0.086 * H), '400', tinta, 'left', 0.34 * W);

    // linha de assinatura
    ctx.strokeStyle = '#2B2B2B';
    ctx.lineWidth = Math.max(1, 0.008 * H);
    ctx.beginPath();
    ctx.moveTo(0.372 * W, 0.868 * H);
    ctx.lineTo(0.700 * W, 0.868 * H);
    ctx.stroke();
    texto(ctx, '(Diretor)', 0.536 * W, 0.942 * H,
      Math.round(0.058 * H), '400', tinta, 'center');

    // oval do botão da especialidade
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
        mini.textContent = 'sem botão';
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

    var sel = id('lote-esp');
    var antes = sel.value;
    sel.innerHTML = '';
    estado.especialidades.forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.id; o.textContent = e.nome;
      sel.appendChild(o);
    });
    if (antes) sel.value = antes;
  }

  function editarEsp (i) {
    var e = espPorId(i);
    if (!e) return;
    editandoEsp = i;
    id('esp-nome').value = e.nome;
    id('esp-cor').value = e.cor;
    id('esp-cor-hex').value = e.cor.toUpperCase();
    id('bt-salvar-esp').textContent = 'Salvar alteração';
    id('bt-cancelar-esp').hidden = false;
    id('p-especialidades').scrollIntoView({ block: 'start' });
  }

  function limparFormEsp () {
    editandoEsp = null; imgPendente = null;
    id('form-esp').reset();
    id('esp-cor').value = '#08A008';
    id('esp-cor-hex').value = '#08A008';
    id('bt-salvar-esp').textContent = 'Adicionar especialidade';
    id('bt-cancelar-esp').hidden = true;
  }

  function removerEsp (i) {
    var usada = estado.lotes.some(function (l) { return l.espId === i });
    if (usada && !confirm('Há lotes usando esta especialidade. Eles também serão removidos. Continuar?')) return;
    var e = espPorId(i);
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

  id('esp-cor').addEventListener('input', function () {
    id('esp-cor-hex').value = this.value.toUpperCase();
  });
  id('esp-cor-hex').addEventListener('input', function () {
    var v = this.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) id('esp-cor').value = v;
  });

  id('esp-img').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) { imgPendente = null; return }
    prepararImagem(f, 520).then(function (url) {
      imgPendente = url;
      aviso('Botão carregado. Agora salve a especialidade.');
    }).catch(function () { aviso('Não consegui ler essa imagem.', true) });
  });

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
    });
  });

  id('form-lote').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var espId = id('lote-esp').value;
    if (!espId) { aviso('Cadastre uma especialidade primeiro.', true); return }
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
      s.textContent = l.nomes.length + ' desbravador' + (l.nomes.length > 1 ? 'es' : '') +
        ' · ' + textoData(l);
      meio.appendChild(b); meio.appendChild(s);

      var tag = document.createElement('span');
      if (e && !e.imgId) { tag.className = 'etiqueta falta'; tag.textContent = 'sem botão' }
      else { tag.className = 'etiqueta'; tag.textContent = 'pronto' }

      var acoes = document.createElement('div');
      acoes.className = 'cartao-acoes';
      var rm = document.createElement('button');
      rm.className = 'icone-bt del'; rm.title = 'Remover lote'; rm.textContent = '✕';
      rm.onclick = function () {
        estado.lotes = estado.lotes.filter(function (x) { return x.id !== l.id });
        salvar(); pintarTudo(); aviso('Lote removido.');
      };
      acoes.appendChild(rm);

      li.appendChild(bol); li.appendChild(meio); li.appendChild(tag); li.appendChild(acoes);
      ul.appendChild(li);
    });
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
      (criadas ? '<br>Defina a cor e o botão das novas especialidades no passo 1.' : '');

    id('massa-txt').value = '';
    id('conta-massa').textContent = '0 linhas válidas';
    aviso('Lotes criados.');
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
  }

  function loteDaPrevia () {
    var i = id('previa-lote').value;
    for (var k = 0; k < estado.lotes.length; k++) if (estado.lotes[k].id === i) return estado.lotes[k];
    return estado.lotes[0] || null;
  }

  function pintarPrevia () {
    var cv = id('previa');
    var ctx = cv.getContext('2d');
    var l = loteDaPrevia();

    if (!l) {
      desenhar(ctx, cv.width, cv.height, {
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
      desenhar(ctx, cv.width, cv.height, {
        cor: e ? e.cor : '#08A008',
        especialidade: e ? e.nome : '',
        nome: l.nomes[0],
        data: textoData(l),
        botao: r[0], logo: r[1],
      });
    });
  }

  id('previa-lote').addEventListener('change', pintarPrevia);

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
    desenhar(ctx, cv.width, cv.height, {
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

  function gerarPdf () {
    var itens = todosOsCertificados();
    if (!itens.length) { aviso('Não há certificados para gerar.', true); return }

    var conf = QUALIDADE[id('qualidade').value];
    var porPagina = id('por-pagina').value;
    var lay = LAYOUTS[porPagina];
    var separar = id('separar').value;

    var cv = document.createElement('canvas');
    cv.width = conf.w; cv.height = Math.round(conf.w / PROPORCAO);
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
          var altCert = lay.larg / PROPORCAO;
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

  function gerarZip () {
    var itens = todosOsCertificados();
    if (!itens.length) { aviso('Não há certificados para gerar.', true); return }
    if (itens.length > 250 && !confirm(itens.length + ' imagens PNG dão um arquivo grande e podem travar o navegador. Em geral o PDF resolve melhor. Continuar mesmo assim?')) return;

    var conf = QUALIDADE[id('qualidade').value];
    var cv = document.createElement('canvas');
    cv.width = conf.w; cv.height = Math.round(conf.w / PROPORCAO);
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
    var escolha = prompt('Digite 1 para baixar um backup, ou 2 para restaurar de um arquivo.', '1');
    if (escolha === '1') {
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
    } else if (escolha === '2') {
      id('restaurar').click();
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
            estado = p.estado;
            cacheImg = {};
            salvar(); pintarTudo();
            aviso('Backup restaurado.');
          });
      } catch (e) { aviso('Arquivo de backup inválido.', true) }
    };
    r.readAsText(f, 'utf-8');
  });

  /* ═══════════ pintura geral ═══════════ */

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
    Object.keys(porEsp).sort().forEach(function (n) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + n.replace(/</g, '&lt;') + '</span><b>' + porEsp[n] + '</b>';
      ul.appendChild(li);
    });
    if (total) {
      var li2 = document.createElement('li');
      li2.innerHTML = '<span><b>Total</b></span><b>' + total + '</b>';
      ul.appendChild(li2);
    }
  }

  function pintarTudo () {
    pintarEspecialidades();
    pintarLotes();
    pintarSeletorPrevia();
    pintarPlacar();
    pintarPrevia();
  }

  /* ═══════════ início ═══════════ */

  carregar();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(pintarTudo);
  }
  pintarTudo();
})();
