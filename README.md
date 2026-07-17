# Sobrevive ou Quebra?

Ferramenta web gratuita, 100% client-side, com duas portas de entrada para educar, diagnosticar e encaminhar cada pessoa para uma oferta afiliada compatível com o contexto dela:

- **Simulador de sobrevivência** — Monte Carlo (1.000 simulações de 100 trades) que mostra se uma estratégia de futuros sobrevive dado banca, alavancagem, risco por trade, win rate e R:R. Mira quem ainda não abriu conta (S2).
- **Raio-X do histórico** — upload de CSV de trades (auto-detecção de colunas Binance/Bybit + mapeamento manual como fallback) gera diagnóstico de win rate, profit factor, sangramento de taxas, revenge trading e overtrading. Mira quem já opera em outra corretora (S1).

Nenhum dado sai do navegador. Sem cadastro, sem backend, sem dependências (HTML/CSS/JS vanilla). Depois do resultado, um roteador pergunta se a pessoa já tem Binance e qual problema quer resolver. Binance continua prioritária para novas contas; quem já tem conta recebe uma alternativa contextual, sem mural de links.

> **Pré-lançamento:** indexação bloqueada de propósito por `<meta name="robots">` e `robots.txt`. Só remover os dois bloqueios depois dos testes finais, tracking e links estarem confirmados.

Contexto completo do projeto (estratégia, scripts de outreach, plano de julho) está no vault DFM: `100 - AREAS/03 - Financiamento/100 - PROJECTS/2 - Active/Venda de produtos afiliados por comissão/`.

## Estrutura

```
index.html          página única
config.js            ÚNICO arquivo a editar pra lançar (refs, telegram, GoatCounter, URL)
styles.css
js/
  montecarlo.js       motor de simulação
  chart.js            desenho das curvas de equity (canvas)
  csv-parser.js       parser CSV genérico + auto-detecção de colunas
  metrics.js          cálculo de métricas e diagnóstico do Raio-X
  example-data.js      CSV sintético pro botão "ver com dados de exemplo"
  share-card.js        geração dos cards 1080x1080 pra download
  app.js                wiring da UI
og-image.png          preview de compartilhamento (WhatsApp/Telegram/X) — marca DLT Academy
assets/                logo/favicon de marca (dlt-mark.png, dlt-logo.png, dlt-logo-light.png)
robots.txt / sitemap.xml
.github/workflows/pages.yml   deploy automático no GitHub Pages a cada push em main
```

## Antes de divulgar — checklist de lançamento

1. Confirmar em `config.js` os links por canal (`refByChannel`) e todos os destinos em `offers`.
2. O Telegram `@tiagolucer` está configurado somente no gate de benefício temporário para indicados; não existe contato aberto ao lado dos CTAs. Preencher ainda o código do site no GoatCounter.
3. Abrir todos os links em janela anônima e registrar o benefício exibido, país, data e condições.
4. Rodar simulador, CSV de exemplo, CSV real, calculadora, cards e todas as combinações do roteador em desktop e celular.
5. Somente depois, trocar o `robots.txt` para `Allow: /`, recolocar o Sitemap e mudar a meta `robots` para `index, follow`.
6. Confirmar o deploy no GitHub Pages e testar o preview do link em WhatsApp/Telegram.
7. Divulgar com `?c=<canal>&v=<variante>` em cada origem.

## Rastreamento

- **GoatCounter**: eventos carregam canal e variante; o roteador também mede respostas, recomendação gerada e clique por oferta.
- **Painéis afiliados**: cadastro e ativação são medidos no programa de cada oferta. Para Binance, `refByChannel` continua permitindo um destino específico por origem quando houver links separados.

## Benefício temporário para indicados

O contato no Telegram não é suporte público. A pessoa declara que concluiu o cadastro pelo link, informa plataforma + UID + data, revisa a mensagem e então abre `@tiagolucer`. Nenhum dado é armazenado no site. O benefício fica pendente até a indicação ser confirmada no painel e depende da disponibilidade da campanha. Nunca pedir senha, 2FA, documento, selfie, chave privada, saldo, carteira ou comprovante financeiro.

## Desenvolvimento local

Sem build. Basta servir a pasta com qualquer servidor estático:

```
python3 -m http.server 8000
```

E abrir `http://localhost:8000`.

### Gate de segurança

Antes de publicar qualquer alteração:

```bash
python3 -m unittest discover -s tests -p 'test_security_check.py'
python3 -m py_compile security_check.py tests/test_security_check.py
python3 security_check.py .
for f in js/*.js config.js; do node --check "$f"; done
```
