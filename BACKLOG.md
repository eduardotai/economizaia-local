# EconomizaIA Local — Backlog Técnico

## Épico 1 — Fundação do projeto
- [ ] Inicializar app Next.js 15 com TypeScript
- [ ] Configurar Tailwind e shadcn/ui
- [ ] Configurar PWA/offline shell
- [ ] Definir arquitetura de pastas (`app`, `features`, `engine`, `db`, `workers`, `rag`, `models`)
- [ ] Configurar lint, format, testes e validação de tipos

## Épico 2 — Persistência local
- [ ] Implementar camada IndexedDB/localForage
- [ ] Criar stores de documentos, perfis, simulações, resultados, regras e relatórios
- [ ] Criar adapters e repositórios locais
- [ ] Criar estratégia de versionamento local de dados

## Épico 3 — Upload e extração documental
- [ ] Upload de PDFs e imagens
- [ ] Extração de texto com pdf.js
- [ ] OCR com Tesseract.js via worker
- [ ] Pipeline de parsing fiscal inicial
- [ ] Tela de revisão de campos extraídos

## Épico 4 — Domínio tributário e rule engine
- [ ] Modelos de domínio tributário
- [ ] Contrato do rule bundle versionado
- [ ] Motor de cálculo determinístico
- [ ] Simulação de cenários (atual vs híbrido vs nano)
- [ ] Confidence bands e política de recusa
- [ ] Trilha de auditoria local

## Épico 5 — RAG local e IA explicativa
- [ ] Indexação local de fontes oficiais
- [ ] Retrieval por contexto normativo
- [ ] Integração com WebLLM
- [ ] Prompt seguro do explicador
- [ ] Chat contextual sobre resultado calculado

## Épico 6 — UX de confiança
- [ ] Onboarding anônimo
- [ ] Dashboard local
- [ ] Cards de economia potencial e alertas
- [ ] Exibição de premissas, regras e fontes
- [ ] Mensagens de privacidade e disclaimers em todas as telas críticas

## Épico 7 — Relatórios e exportação
- [ ] Gerar relatório estruturado
- [ ] Exportar PDF local
- [ ] Incluir metadados de auditoria e versão normativa
- [ ] Histórico local de análises

## Épico 8 — Performance e robustez
- [ ] Lazy loading do modelo local
- [ ] Fallback sem WebGPU
- [ ] Chunking de documentos grandes
- [ ] Otimização para celulares médios
- [ ] Hardening offline-first

## Épico 9 — Testes
- [ ] Testes unitários do rule engine
- [ ] Testes de regressão fiscal por snapshot
- [ ] Testes de parsing documental
- [ ] Testes de UX crítica
- [ ] Testes offline/PWA

## Sprints sugeridas
### Sprint 1
- Fundação do projeto
- Persistência local base
- Upload inicial

### Sprint 2
- PDF/OCR
- parsing inicial
- revisão manual

### Sprint 3
- rule engine v1
- cenários comparativos básicos
- auditoria inicial

### Sprint 4
- RAG local
- relatório PDF
- dashboard

### Sprint 5
- WebLLM explicativo
- chat local
- performance mobile

### Sprint 6
- testes de regressão
- hardening
- refinamento UX e preparação para demo
