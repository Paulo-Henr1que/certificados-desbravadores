# Gerador de Certificados · Desbravadores

Gera certificados de especialidade em massa. Roda no navegador; nada sai do computador.

1. Especialidades: nome, cor da moldura e boton (salvos).
2. Lotes: especialidade + data + nomes (um por linha), ou importação em massa `Especialidade ; Nome` (cola do Excel ou CSV).
3. Gerar: PDF (1/2/3 por página, por especialidade ou único) ou PNGs em ZIP.

Backup no topo salva tudo em JSON.

## Robustez
- Bibliotecas de PDF e ZIP embutidas em `vendor/`: não dependem de CDN externo.
- Dados salvos corrompidos ou de backup adulterado são saneados ao carregar; a página sempre abre.
- Sem IndexedDB (aba anônima), as imagens ficam na memória da sessão.
- Qualquer erro inesperado mostra um aviso, sem perder dados.
- Teste de carga: 700 certificados em 30 especialidades geram em ~10 s (ZIP de 31 PDFs, ~67 MB).
- Site estático na Vercel: sem servidor, sem banco, sem manutenção.
