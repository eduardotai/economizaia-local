# Demo guiada do MVP local-first prudente

Este guia prepara a apresentação do **EconomizaIA Local** como um MVP conservador, rastreável e útil para conversa de produto.

> Importante: **não há cálculo fiscal oficial** aqui. A demo mostra fluxo, guardrails, revisão humana obrigatória, evidência local e exportação de relatório mock.

## Objetivo da demo

Mostrar, em poucos minutos, que o MVP já consegue:

- iniciar com entrada manual rápida
- reforçar que tudo é **local-first**
- evidenciar **privacidade e rastreabilidade** no fluxo
- exigir **revisão humana** antes de qualquer uso prático
- explicitar bloqueios e prontidão em vez de fingir confiança indevida
- gerar um **relatório local** com snapshot do gate e trilha demonstrável

## Checklist pré-demo

### Ambiente

- [ ] `npm install` executado
- [ ] `npm run dev` disponível em `http://localhost:3000`
- [ ] navegador limpo ou com estado conhecido
- [ ] pelo menos 1 arquivo local separado para a etapa documental (PDF, imagem ou XML)

### Validação técnica

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:manual-first`
- [ ] `npm run test:readiness`

### Ponto de atenção para o apresentador

- [ ] reforçar que o motor é **mock/protótipo**
- [ ] não chamar o resultado de cálculo oficial
- [ ] mostrar que o produto prefere **bloquear** a inventar precisão
- [ ] enfatizar que a IA local serve para **explicar**, não para decidir
- [ ] destacar que o relatório final só deve ser gerado quando o gate estiver liberado

## Fluxo ideal de apresentação

### Fluxo recomendado (4-6 minutos)

1. **Home / posicionamento do produto**
   - Mostrar a proposta local-first, os sinais de confiança e o discurso de prudência.
   - Dizer: "O objetivo aqui não é automatizar decisão fiscal oficial; é organizar a análise com rastreabilidade e revisão humana."

2. **Entrada principal no modo rápido**
   - Ir para a seção de simulação.
   - Preencher faturamento, despesas, atividade, regime e período.
   - Marcar os dois consentimentos essenciais.
   - Mostrar o gate único de prontidão.

3. **Leitura local mock**
   - Clicar em **Validar prontidão e gerar leitura local**.
   - Destacar sinais de confiança, lacunas, premissas e cenários artificiais.
   - Explicar que o MVP mostra limites explicitamente.

4. **Revisão documental guiada**
   - Ir para documentos.
   - Enviar um arquivo local.
   - Revisar campos críticos.
   - Clicar em **Confirmar revisão manual**.
   - Mostrar que sem esse passo o fluxo permanece bloqueado.

5. **Relatório final local**
   - Ir para relatório.
   - Mostrar o gate final e o status das regras.
   - Gerar o relatório local.
   - Baixar HTML ou usar **Imprimir / salvar em PDF**.
   - Destacar o snapshot do gate anexado ao relatório.

## Roteiro curto de apresentação

Use algo próximo disto:

> "Este MVP roda localmente no navegador e evita prometer precisão regulatória que ele ainda não tem. Primeiro eu entro com dados mínimos no modo rápido. O sistema valida a prontidão e só gera uma leitura mock quando o mínimo está coerente. Se eu trouxer documentos, eles passam por extração local e revisão humana obrigatória. A IA local aqui é uma camada de apoio explicativo, não uma fonte de decisão. Quando o gate final está liberado, eu salvo um relatório local com evidência do estado da análise e posso exportar em HTML ou imprimir para PDF."

## Narrativa prática por etapa

### 1. Entrada
- "Começamos pelo caminho mais rápido para colocar a análise em contexto."
- "Mesmo no modo rápido, o fluxo mantém consentimento explícito e leitura prudente."

### 2. Gate de prontidão
- "A interface deixa claro o que está pronto, o que está pendente e por que algo pode ser recusado."

### 3. Documentos
- "Documento não entra como verdade automática: entra como insumo revisável."

### 4. Relatório
- "O relatório é local, exportável e carrega um snapshot do gate para preservar contexto e auditabilidade."

## Ordem prática recomendada para demo real

### Melhor sequência
1. Mostrar a home por 20-30 segundos
2. Pular direto para o modo rápido
3. Gerar a leitura local
4. Mostrar confiança, bundle e lacunas
5. Ir para documentos e revisar 1 arquivo
6. Voltar ao relatório e concluir
7. Encerrar com export HTML/PDF

### O que evitar na apresentação
- ficar explicando arquitetura antes de mostrar uso
- chamar cenários mock de cálculo real
- vender o bundle como pacote oficial homologado
- tentar demonstrar OCR como parte “mágica” principal

## Resultado esperado da demo

Ao final, quem assistir deve entender que:

- o MVP já possui uma jornada de ponta a ponta
- a proposta é **prudência operacional**, não automação irresponsável
- o produto é local-first e manual-first por design
- a revisão humana não é detalhe: é parte central da experiência
- a IA local existe para apoiar a análise e explicar contexto
- existe saída final auditável, mesmo em modo mock
