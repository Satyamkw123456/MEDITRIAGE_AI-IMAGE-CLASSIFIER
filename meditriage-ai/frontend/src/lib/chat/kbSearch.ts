import enKb from './kb/en.json';
import hiKb from './kb/hi.json';
import mrKb from './kb/mr.json';

export interface KBAction {
  label: string;
  href: string;
}

export interface KBEntry {
  id: string;
  q: string[];
  a: string;
  actions?: KBAction[];
  tags: string[];
  source: string;
  audience: 'public' | 'patient' | 'clinician';
}

const KB_BY_LOCALE: Record<string, KBEntry[]> = {
  en: enKb as KBEntry[],
  hi: hiKb as KBEntry[],
  mr: mrKb as KBEntry[],
};

// Common synonym mapping across languages
const SYNONYMS: Record<string, string[]> = {
  doctor: ['clinician', 'physician', 'doctor', 'डॉक्टर', 'वैद्य'],
  emergency: ['urgent', 'ambulance', '112', '108', 'आपातकाल', 'तातडीचे', 'धोका'],
  intake: ['symptom', 'triage', 'form', 'तपासणी', 'लक्षण'],
  elder: ['geriatric', 'senior', 'parent', 'बुजुर्ग', 'ज्येष्ठ'],
  medicine: ['drug', 'prescription', 'tablet', 'दवा', 'औषध', 'गोळी'],
  privacy: ['dpdp', 'security', 'consent', 'गोपनीयता', 'सुरक्षा'],
};

// Tokenizer supporting both Latin script and Devanagari scripts
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  // Normalize, lowercase, remove punctuation, split on whitespace and boundary chars
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'।॥]/g, ' ');

  const rawTokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  // Expand with synonyms
  const expanded: string[] = [];
  for (const token of rawTokens) {
    expanded.push(token);
    for (const [canonical, syns] of Object.entries(SYNONYMS)) {
      if (syns.includes(token) || token.includes(canonical)) {
        expanded.push(canonical);
      }
    }
  }

  return Array.from(new Set(expanded));
}

export interface KBSearchResult {
  entry: KBEntry;
  score: number;
}

// BM25 scoring constants
const K1 = 1.2;
const B = 0.75;
const THRESHOLD = 0.45; // Minimum confident match threshold

export function kbSearch(query: string, locale = 'en'): KBSearchResult | null {
  const entries: KBEntry[] = KB_BY_LOCALE[locale] || KB_BY_LOCALE.en;
  if (!entries || entries.length === 0 || !query.trim()) return null;

  const queryTokens = tokenizeText(query);
  if (queryTokens.length === 0) return null;

  // Pre-calculate document lengths and average length
  const docTokensList = entries.map((e) => {
    const allQuestions = e.q.join(' ');
    const allText = `${allQuestions} ${e.a} ${e.tags.join(' ')}`;
    return tokenizeText(allText);
  });

  const totalDocs = entries.length;
  const avgDocLength =
    docTokensList.reduce((acc, curr) => acc + curr.length, 0) / totalDocs;

  // Calculate term document frequencies
  const docFreqs: Record<string, number> = {};
  for (const term of queryTokens) {
    let count = 0;
    for (const tokens of docTokensList) {
      if (tokens.includes(term)) count++;
    }
    docFreqs[term] = count;
  }

  // Score each entry
  let bestScore = 0;
  let bestEntry: KBEntry | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const docTokens = docTokensList[i];
    const docLen = docTokens.length;

    let score = 0;

    for (const term of queryTokens) {
      const df = docFreqs[term] || 0;
      if (df === 0) continue;

      // IDF calculation
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));

      // Term frequency in this document
      const tf = docTokens.filter((t) => t === term).length;

      // Bonus if term appears directly in any question variant
      const inQuestion = entry.q.some((q) => q.toLowerCase().includes(term));
      const qBonus = inQuestion ? 1.5 : 1.0;

      // BM25 formula
      const tfWeight = (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen) / avgDocLength));
      score += idf * tfWeight * qBonus;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= THRESHOLD) {
    return {
      entry: bestEntry,
      score: bestScore,
    };
  }

  // Fallback: If locale was hi or mr and had no match, attempt en KB with query
  if (locale !== 'en') {
    return kbSearch(query, 'en');
  }

  return null;
}
