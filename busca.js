// Interface propria sobre a API do Pagefind. O widget pronto do Pagefind
// traria estilo proprio e destoaria do desenho (D-041).
(() => {
  const campo = document.getElementById('busca-campo');
  const contagem = document.getElementById('busca-contagem');
  if (!campo || !contagem) return;

  const modelo = contagem.dataset.modelo || '{n}';
  // D-041: o contador em repouso (todos os artigos) e renderizado no
  // servidor (SearchBar.astro) para existir sem JavaScript. Toda vez que
  // a busca/filtro volta ao estado vazio, restaura esse MESMO texto em vez
  // de limpar — sem isso o leitor nao distingue "sem busca ativa" de
  // "a busca zerou o contador".
  const repouso = contagem.dataset.repouso || '';
  const lista = [...document.querySelectorAll('.item')];
  const destaque = document.querySelector('.destaque');

  const mostrarTudo = () => {
    for (const el of lista) el.hidden = false;
    if (destaque) destaque.hidden = false;
    contagem.textContent = repouso;
  };

  let pagefind = null;
  let mesclado = false;
  const carregar = async () => {
    if (!pagefind) pagefind = await import('/pagefind/pagefind.js');
    if (!mesclado) {
      // D-045: o Pagefind segmenta o indice por <html lang>. A home de um
      // idioma lista tambem os orfaos do outro idioma (D-021), entao a
      // busca precisa achar palavras que so existem no indice do OUTRO
      // idioma. mergeIndex aponta para o mesmo diretorio de bundle,
      // carregando os pedaços do idioma indicado junto do idioma primario
      // (detectado a partir de document.documentElement.lang); depois disso
      // search() ja devolve resultados dos dois indices unidos.
      mesclado = true;
      const atual = (document.documentElement.lang || '').toLowerCase();
      const outro = atual.startsWith('pt') ? 'en' : 'pt-br';
      try {
        await pagefind.mergeIndex('/pagefind/', { language: outro });
      } catch {
        // Segue so com o indice primario: busca parcial e melhor que travar.
      }
    }
    return pagefind;
  };

  let ultimo = 0;
  const buscar = async (termo) => {
    const meu = ++ultimo;
    if (!termo.trim()) return mostrarTudo();

    let achados = [];
    try {
      const pf = await carregar();
      const r = await pf.search(termo);
      // Sem corte artificial: o acervo tem dezenas de URLs, nao milhares —
      // intersectar o resultado inteiro com os cards renderizados.
      achados = await Promise.all(r.results.map((x) => x.data()));
    } catch {
      if (meu !== ultimo) return; // resposta velha, ignora
      // Uma falha de busca nao pode deixar uma lista parcialmente
      // filtrada com um marcador de erro por cima: volta tudo a ficar
      // visivel antes de mostrar o estado de falha.
      mostrarTudo();
      contagem.textContent = '—';
      return;
    }
    if (meu !== ultimo) return; // resposta velha, ignora

    const urls = new Set(achados.map((a) => a.url.replace(/index\.html$/, '')));
    let visiveis = 0;
    for (const el of lista) {
      const bate = urls.has(new URL(el.href).pathname);
      el.hidden = !bate;
      if (bate) visiveis += 1;
    }
    if (destaque) {
      const bate = urls.has(new URL(destaque.href).pathname);
      destaque.hidden = !bate;
      if (bate) visiveis += 1;
    }
    contagem.textContent = modelo.replace('{n}', String(visiveis));
  };

  let timer;
  campo.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => buscar(campo.value), 150);
  });

  // Os chips sao botoes de filtro puro (D-044): as paginas de categoria e
  // tag foram removidas, entao nao ha mais navegacao real para preservar.
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      clearTimeout(timer);
      ultimo += 1; // invalida qualquer busca assincrona em andamento
      const cat = chip.dataset.cat || '';
      for (const c of document.querySelectorAll('.chip')) {
        const ligado = c === chip;
        c.classList.toggle('chip-on', ligado);
        c.setAttribute('aria-pressed', String(ligado));
      }
      campo.value = '';
      let visiveis = 0;
      for (const el of lista) {
        const bate = !cat || el.querySelector('.etiqueta')?.dataset.slug === cat;
        el.hidden = !bate;
        if (bate) visiveis += 1;
      }
      if (destaque) {
        const bate = !cat || destaque.dataset.slug === cat;
        destaque.hidden = !bate;
        if (bate) visiveis += 1;
      }
      contagem.textContent = cat ? modelo.replace('{n}', String(visiveis)) : repouso;
    });
  }
})();
