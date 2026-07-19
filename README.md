# Sobrevive ou Quebra?

Ferramenta web gratuita, 100% client-side, com duas experiências para educar, diagnosticar e encaminhar cada pessoa para uma oferta afiliada compatível com o contexto dela:

- **Simulador de sobrevivência** — Monte Carlo (1.000 simulações de 100 trades) que mostra se uma estratégia de futuros sobrevive dado banca, alavancagem, risco por trade, win rate e R:R. Mira quem ainda está avaliando a estratégia ou a abertura de conta.
- **Raio-X do histórico** — upload de CSV de trades (auto-detecção de colunas Binance/Bybit + mapeamento manual como fallback) gera diagnóstico de win rate, profit factor, sangramento de taxas, revenge trading e overtrading. A mesma análise pode ser acessada diretamente por `/historico/` em campanhas voltadas a quem já opera.

Nenhum dado sai do navegador. Sem cadastro, sem backend, sem dependências (HTML/CSS/JS vanilla). Depois do resultado, o próximo passo considera se a pessoa já possui Binance: uma conta nova elegível pode receber a oferta Binance; quem já tem conta não recebe promessa de benefício de novo usuário.

> **Pré-lançamento:** indexação bloqueada de propósito por `<meta name="robots" content="noindex">`. O `robots.txt` mantém `Allow: /` para os crawlers conseguirem ler essa diretiva. Só liberar a indexação depois dos testes finais, links e primeira atribuição estarem confirmados.

## Entradas

- `/` — experiência completa: simulador, Raio-X, calculadora de posição e roteador contextual.
- `/historico/` — variante focada em CSV para distribuição controlada. Reutiliza os módulos canônicos de parsing, métricas, dados de exemplo, cards e configuração; não é uma nova ferramenta do catálogo.

Use `?c=<canal>&v=<variante>` nas duas entradas quando a origem precisar ser distinguida. Exemplo: `/historico/?c=grupos&v=a`.

## Estrutura

```
index.html                 experiência completa
historico/index.html       entrada focada no Raio-X
config.js                  refs, destinos, Telegram e configuração operacional
styles.css                 design system da ferramenta
styles-historico.css       ajustes exclusivos da entrada focada
js/
  montecarlo.js             motor de simulação
  chart.js                  desenho das curvas de equity (canvas)
  csv-parser.js             parser CSV genérico + auto-detecção de colunas
  metrics.js                cálculo de métricas e diagnóstico do Raio-X
  example-data.js           CSV sintético pro botão "ver com dados de exemplo"
  share-card.js             geração dos cards 1080x1080 pra download
  app.js                    wiring da experiência completa
  historico.js              wiring da entrada focada
og-image.png                preview de compartilhamento
assets/                     logos e favicon
robots.txt / sitemap.xml
.github/workflows/pages.yml deploy automático no GitHub Pages após push em main
```

## Antes de divulgar — checklist de lançamento

1. Confirmar em `config.js` os links por canal (`refByChannel`) e todos os destinos em `offers`.
2. Abrir todos os links em janela anônima e registrar o benefício exibido, país, data e condições.
3. Rodar simulador, CSV de exemplo, pelo menos um CSV real, calculadora, cards e todas as combinações do roteador em desktop e celular.
4. Testar separadamente `/historico/`: upload, teclado, mapeamento manual, diagnóstico, download do card e os dois caminhos da pergunta sobre Binance.
5. Confirmar canonical, OG, CSP, `noindex`, links externos e ausência de erros no console nas duas entradas.
6. Confirmar o deploy no GitHub Pages e testar o preview do link em WhatsApp/Telegram.
7. Divulgar com `?c=<canal>&v=<variante>` em cada origem.
8. Somente depois da atribuição validada, decidir se a indexação deve ser liberada.

## Medição

- Os parâmetros `?c=` e `?v=` distinguem canal e variante e são preservados pelo fluxo quando necessário.
- Cadastro, atribuição e ativação são confirmados nos painéis dos programas afiliados.
- O runtime aceita eventos do GoatCounter quando a biblioteca estiver efetivamente carregada, mas nenhuma camada adicional de analytics é requisito para o primeiro ciclo de distribuição.
- Para Binance, `refByChannel` permite destinos específicos por origem quando o programa disponibilizar links separados.

## Benefício temporário para indicados

O contato no Telegram não é suporte público. A pessoa declara que concluiu o cadastro pelo link, informa plataforma + UID + data, revisa a mensagem e então abre `@<removido>`. Nenhum dado é armazenado no site. O benefício fica pendente até a indicação ser confirmada no painel e depende da disponibilidade da campanha. Nunca pedir senha, 2FA, documento, selfie, chave privada, saldo, carteira ou comprovante financeiro.

## Desenvolvimento local

Sem build. Basta servir a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

Abrir:

- `http://localhost:8000/`
- `http://localhost:8000/historico/?c=teste&v=a`

### Gate de segurança

Antes de publicar qualquer alteração:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
python3 -m py_compile security_check.py tests/*.py
python3 security_check.py .
for f in js/*.js config.js; do node --check "$f"; done
git diff --check
```

O checker principal examina os HTMLs da raiz. Entradas em subdiretórios devem possuir teste de contrato que execute `check_html()` diretamente; `/historico/` faz isso em `tests/test_historico_entry.py`.
