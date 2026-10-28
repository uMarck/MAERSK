// Função serverless (Vercel): lê o portal e devolve a tabela "Split de devolução - Manaus" em JSON.
const cheerio = require("cheerio");

// >>> TROQUE AQUI se o endereço do portal mudar <<<
const URL_PORTAL = "https://www.portalagendamentos.com.br/pt-br/site/devimportacao";

const limpa = (s) => (s || "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").replace(/\/\s*\/+/g, "/").replace(/\s*\/\s*$/, "").trim();

function parseManaus(html) {
  const $ = cheerio.load(html);
  let alvo = null;
  // Tabela mais interna cujo texto contém o título do split de Manaus
  $("table").each((_, t) => {
    const $t = $(t);
    if ($t.find("table").length) return;
    const txt = limpa($t.text());
    if (/Split de devolu[çc][aã]o\s*-\s*Manaus/i.test(txt)) alvo = $t;
  });
  if (!alvo) throw new Error("Tabela de Manaus não encontrada (o layout do portal pode ter mudado).");

  alvo.find("br").replaceWith(" / ");
  // Expande colspan para manter as colunas alinhadas
  const linhas = [];
  alvo.find("tr").each((_, tr) => {
    const cel = [];
    $(tr).children("td,th").each((__, td) => {
      const span = parseInt($(td).attr("colspan") || "1", 10);
      const txt = limpa($(td).text());
      for (let i = 0; i < span; i++) cel.push(txt);
    });
    if (cel.length) linhas.push(cel);
  });

  const iHead = linhas.findIndex((l) => /tipo\s*\/\s*dia/i.test(l[0]));
  if (iHead < 0) throw new Error("Cabeçalho 'Tipo/Dia' não encontrado.");

  // O portal repete colunas (células com colspan=2 ou colunas duplicadas).
  // Mantém só a primeira coluna de cada cabeçalho repetido em sequência.
  const head = linhas[iHead];
  const manter = head.map((_, i) => i).filter((i) => i === 0 || head[i].toUpperCase() !== head[i - 1].toUpperCase());
  const dias = manter.slice(1).map((i) => head[i]);
  const rows = linhas.slice(iHead + 1)
    .filter((l) => l.length > 1 && l[0])
    .map((l) => ({ tipo: l[0], valores: manter.slice(1).map((i) => l[i] || "-") }));
  return { dias, rows };
}

async function baixa() {
  const r = await fetch(URL_PORTAL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DevolucaoManaus/1.0)" } });
  if (!r.ok) throw new Error("Portal respondeu " + r.status);
  const buf = await r.arrayBuffer();
  let html = new TextDecoder("utf-8").decode(buf);
  if (html.includes("\uFFFD")) html = new TextDecoder("windows-1252").decode(buf);
  return html;
}

module.exports = async (req, res) => {
  try {
    const dados = parseManaus(await baixa());
    // Cache de 1h no servidor da Vercel; o portal é consultado no máx. 1x/hora
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ atualizadoEm: new Date().toISOString(), ...dados });
  } catch (e) {
    res.status(502).json({ erro: String(e.message || e) });
  }
};
module.exports.parseManaus = parseManaus;
