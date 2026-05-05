import localforage from "localforage";

/**
 * Limpa TODOS os dados do app (IndexedDB + localStorage)
 * Usado para cumprir Direito ao Esquecimento (LGPD)
 */
export async function deleteAllUserData(): Promise<void> {
  try {
    // Limpa todos os stores do localforage
    await localforage.clear();

    // Limpa localStorage (se houver algo)
    localStorage.clear();

    // Limpa sessionStorage
    sessionStorage.clear();

    console.log("[LGPD] Todos os dados do usuário foram excluídos com sucesso.");
  } catch (error) {
    console.error("[LGPD] Erro ao excluir dados:", error);
    throw new Error("Falha ao excluir dados. Tente novamente.");
  }
}

/**
 * Exporta todos os dados atuais em JSON (Direito de Portabilidade)
 */
export async function exportAllUserData(): Promise<string> {
  try {
    const allData: Record<string, unknown> = {};

    // Exporta todos os stores do localforage
    const keys = await localforage.keys();
    for (const key of keys) {
      allData[key] = await localforage.getItem(key);
    }

    // Adiciona metadados
    allData._exportedAt = new Date().toISOString();
    allData._appVersion = "0.1.0";
    allData._source = "EconomizaIA Local - Exportação LGPD";

    return JSON.stringify(allData, null, 2);
  } catch (error) {
    console.error("[LGPD] Erro ao exportar dados:", error);
    throw new Error("Falha ao exportar dados.");
  }
}
