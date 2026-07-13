# Sobrevive ou Quebra?

Ferramenta web gratuita, 100% client-side, com duas portas de entrada pra converter tráfego em indicados qualificados de afiliado Binance:

- **Simulador de sobrevivência** — Monte Carlo (1.000 simulações de 100 trades) que mostra se uma estratégia de futuros sobrevive dado banca, alavancagem, risco por trade, win rate e R:R. Mira quem ainda não abriu conta (S2).
- **Raio-X do histórico** — upload de CSV de trades (auto-detecção de colunas Binance/Bybit + mapeamento manual como fallback) gera diagnóstico de win rate, profit factor, sangramento de taxas, revenge trading e overtrading. Mira quem já opera em outra corretora (S1).

Nenhum dado sai do navegador. Sem cadastro, sem backend, sem dependências (HTML/CSS/JS vanilla).

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

1. Editar `config.js`: colar os links ref da Binance por canal (`refByChannel`), o username do Telegram, e o código do site no GoatCounter (goatcounter.com, gratuito, sem cookies).
2. Habilitar GitHub Pages neste repo (Settings → Pages → Source: GitHub Actions) — o workflow já está pronto, só falta o primeiro push disparar.
3. Testar a URL final: rodar o simulador, subir um CSV real, conferir que os botões de download geram os cards.
4. Testar o preview de link (OG image) mandando a URL pra você mesmo no WhatsApp/Telegram.
5. Divulgar com `?c=<canal>` em cada lugar diferente (grupos, whats, yt, bio, tg-ads) pra rastrear qual canal converte — o painel de afiliados da Binance mostra o funil por ref.

## Rastreamento

- **GoatCounter**: pageview por canal/variante, cliques em "ver exemplo", upload concluído, cliques nos CTAs (ref e Telegram).
- **Binance**: 1 link ref por canal (regra do plano de julho) — cadastro → ativo aparece no painel de afiliados.

## Desenvolvimento local

Sem build. Basta servir a pasta com qualquer servidor estático:

```
python3 -m http.server 8000
```

E abrir `http://localhost:8000`.
