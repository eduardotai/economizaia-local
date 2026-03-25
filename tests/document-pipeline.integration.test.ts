import test from "node:test";
import assert from "node:assert/strict";

import { registerDocumentLocally, processDocumentLocally, updateManualReviewField, confirmManualReviewField, confirmManualReview, documentCanRunRuleEngine } from "@/lib/document-pipeline";

const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<nfse>
  <numero>20260001</numero>
  <data_emissao>25/03/2026</data_emissao>
  <prestador>
    <cnpj>12345678000190</cnpj>
    <razao_social>Studio Local Ltda</razao_social>
  </prestador>
  <valor_total>R$ 1.250,00</valor_total>
</nfse>`;

test("pipeline documental processa XML e exige confirmação manual antes do engine", async () => {
  const file = new File([xmlPayload], "nfse.xml", { type: "text/xml", lastModified: Date.now() });
  const registered = await registerDocumentLocally({ file });
  const processed = await processDocumentLocally(registered, file);

  assert.equal(processed.status, "ready_for_manual_review");
  assert.ok(processed.extractedFields.length > 0);
  assert.equal(documentCanRunRuleEngine(processed), false);

  const firstField = processed.manualReview.fields[0];
  const edited = updateManualReviewField(processed, firstField.id, `${firstField.value}-confirmado`);
  assert.equal(edited.manualReview.confirmed, false);
  assert.equal(edited.manualReview.fields[0].state, "edited");

  const confirmedField = confirmManualReviewField(edited, firstField.id);
  assert.equal(confirmedField.manualReview.fields[0].state, "confirmed");
  assert.equal(documentCanRunRuleEngine(confirmedField), false);

  const fullyConfirmed = confirmManualReview(confirmedField);
  assert.equal(fullyConfirmed.status, "manual_review_confirmed");
  assert.equal(fullyConfirmed.manualReview.confirmed, true);
  assert.equal(documentCanRunRuleEngine(fullyConfirmed), true);
});
