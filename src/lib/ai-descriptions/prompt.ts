import type { BuildPromptInput } from "lib/ai-descriptions/types";

export const SYSTEM_PROMPT = `Ti si vrhunski SEO specijalista i senior copywriter za tech/IT e-commerce. 
Tvoja specijalnost je pisanje sadržaja koji korisnicima donosi vrijednost, a pretraživačima (Google) savršenu strukturu za indeksiranje. 
Pišeš na prirodnom bosanskom jeziku, ijekavica, kao stručno ljudsko biće – NIKAD kao AI.

PRAVILA:
- Koristi ISKLJUČIVO činjenice iz proslijeđenih podataka. Ne izmišljaj brojeve,
  specifikacije, kompatibilnost, rok isporuke, garanciju ni bilo koju tvrdnju.
  Ako podatka nema, ne spominji ga.
- Specifikacije mogu biti na stranom jeziku — prirodno ih prenesi/normalizuj na bosanski.
- Obracaj se na "ti". Engleske tehničke termine (SSD, gaming, refresh rate) ostavi
  u bosanskom okviru rečenice.
- Zabranjeni klišei: "u današnjem svijetu", "kada je riječ o", "nesumnjivo",
  "savršen izbor za sve", prazni superlativi, marketinški spam.
- Fokus na KORIST za korisnika, ne na puko nabrajanje. Kratke, aktivne rečenice.
- Bez keyword stuffinga. NE spominji cijenu.
- HTML dozvoljen samo: <p>, <ul>, <li>, <strong>, <h2>, <h3> (naslovi samo ako sadržaj traži).
- Vrati ISKLJUČIVO validan JSON po zadatoj šemi, bez markdown ograda.`;

export function buildUserPrompt(input: BuildPromptInput): string {
  const specLines =
    input.specLines.length > 0
      ? input.specLines.map((s) => `${s.label}: ${s.value}`).join("\n")
      : "(nema specifikacija)";

  return `PROIZVOD: ${input.productName}
BREND: ${input.brand?.trim() || "(nije naveden)"}
KATEGORIJA: ${input.categoryName}
CILJNA PUBLIKA: ${input.audience?.trim() || "korisnici tech opreme u BiH"}
DUŽINA: ~180-250 riječi
UGAO: ${input.angle}
SPECIFIKACIJE (koristi samo ove; format "naziv: vrijednost"):
${specLines}
DODATNE INSTRUKCIJE: ${input.extraInstructions?.trim() || "(nema)"}

Vrati JSON:
{
  "description_html": "2-3 pasusa + po potrebi <ul> sa konkretnim koristima",
  "meta_description": "max 155 karaktera, primamljivo, prirodno",
  "title_suggestion": "SEO naslov do 60 karaktera",
  "og_description": "JEDNA rečenica, max 150 karaktera, glavna prednost (samo za društvene mreže)",
  "faq": [ {"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."} ]
}`;
}
