# Sobrevive ou Quebra?

Ferramenta web gratuita, 100% client-side, para quem **já tem patrimônio exposto e teme uma queda**. Ela não tenta prever preço: compara o que cada rota de proteção faz com o dinheiro **nos mesmos cenários sorteados**, para mostrar o formato do risco — que é o que separa proteção de aposta.

Três etapas na mesma página:

1. **Antes dos números: o que você teme que aconteça?** — a entrada é um medo específico, não uma planilha. Os controles já começam num ponto compatível com o caso escolhido.
2. **O que cada proteção faz com o seu dinheiro** — 1.000 trajetórias de preço para o prazo informado, calculadas com e sem proteção usando o **mesmo sorteio**, comparando quatro rotas: não fazer nada, reduzir posição, travar com futuros e comprar seguro (opção de venda).
3. **Calculadora de tamanho da proteção** — quanto cobre a parte que se quer proteger, quanta margem exige e em que preço a proteção seria encerrada antes da hora.

Depois do resultado, um roteador pergunta se a pessoa já tem Binance e qual objetivo ela tem, e recomenda **uma** oferta compatível com o contexto — sem mural de links.

Nenhum dado sai do navegador. Sem cadastro, sem backend, sem dependências (HTML/CSS/JS vanilla).

> **O que o modelo assume:** trajetórias sem tendência, volatilidade típica da classe escolhida, proteção montada hoje e mantida até o fim do prazo. O prêmio do seguro é um valor **informado pela pessoa** — não cotamos opção. Não simula spread, corretagem, imposto, ajuste diário nem execução parcial.

## Estrutura

```
index.html            página única
config.js             ÚNICO arquivo a editar pra lançar (refs por canal, offers, GoatCounter, URL)
styles.css
js/
  protection.js        motor das quatro rotas de proteção
  chart.js             desenho das curvas (canvas)
  share-card.js        geração dos cards para download
  app.js               wiring da UI, roteador de ofertas
security_check.py     gate de política de segurança
tests/
  test-protection.mjs   contrato do motor de proteção
  test_security_check.py
og-image.png          preview de compartilhamento — marca DLT Academy
assets/               logo e favicon de marca
robots.txt / sitemap.xml
.github/workflows/
  ci.yml              gates em PR e push para main
  pages.yml           deploy no GitHub Pages
```

## Estado de publicação

**No ar e indexável** em `https://sobrevive-ou-quebra.dlt.academy/`, servindo `<meta name="robots" content="index, follow">`. O `robots.txt` mantém `Allow: /`.

## Rastreamento

- **GoatCounter**: os eventos carregam canal e variante; o roteador mede respostas, recomendação gerada e clique por oferta. Fica inerte enquanto `goatCounterSite` estiver vazio — isso é esperado, não é defeito.
- **Painéis afiliados**: cadastro e ativação são medidos no programa de cada oferta. `refByChannel` permite um destino específico por origem quando houver links separados.

Divulgar sempre com `?c=<canal>&v=<variante>`. Canal fora da allowlist é descartado em silêncio, e o teste nasce sem origem.

## Desenvolvimento local

Sem build. Basta servir a pasta com qualquer servidor estático:

```
python3 -m http.server 8000
```

E abrir `http://localhost:8000`.

### Gates

O `ci.yml` roda isto em todo PR e push para `main`. Para rodar antes de abrir o PR:

```bash
python3 -m py_compile security_check.py
python3 security_check.py .
node --check config.js
find js -name '*.js' -print0 | xargs -0 -n1 node --check
node tests/test-protection.mjs
python3 -m unittest discover -s tests -v
```

## Regras que não mudam

- **Nenhum dado pessoal é pedido, coletado ou armazenado.** Não existe formulário, cadastro nem contato pessoal nesta página.
- Nunca pedir senha, 2FA, documento, selfie, chave privada, saldo, carteira ou comprovante financeiro.
- Toda oferta afiliada é declarada como tal, e as condições exibidas pela plataforma no cadastro prevalecem sobre qualquer descrição daqui.
