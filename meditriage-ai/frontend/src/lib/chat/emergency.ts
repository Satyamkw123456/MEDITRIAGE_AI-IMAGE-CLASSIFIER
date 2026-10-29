/**
 * Deterministic Client-Side Emergency Intercept
 * Scans user input for acute emergency red-flags across English, Hindi, and Marathi.
 * If matched: instantly interrupts conversation with Call 112 protocol.
 */

const EMERGENCY_REGEXES: RegExp[] = [
  // Cardiac / Crushing Chest Pain
  /\b(crush(ing|ed)?\s+chest|chest\s+(pain|pressure|tightness|feels\s+crushed)|radiat(ing|es|ed)?\s+(to\s+)?(my\s+|the\s+)?(left\s+)?(arm|jaw|neck|back)|heart\s+attack)\b/i,
  /(छाती\s*में\s*(बहुत\s*)?(तेज\s*)?दर्द|छाती\s*दब\s*रही|बाएं\s*हाथ\s*में\s*दर्द|पसीना\s*आ\s*रहा)/i,
  /\b(chhati\s+me\s+dard|chhati\s+dabaav)\b/i,
  /(छातीत\s*(तीव्र\s*)?वेदना|छाती\s*दाबली\s*जातेय|डाव्या\s*हातात\s*कळ)/i,
  /\b(chhatit\s+vedna|davyat\s+hatat\s+kal)\b/i,

  // Stroke / FAST Signs
  /\b(slurr(ed|ing)\s+speech|facial\s+droop|face\s+droop|arm\s+weakness|one[\s-]sided\s+weakness|loss\s+of\s+speech|paraly(zed|sis))\b/i,
  /(लकवा|मुंह\s*टेढ़ा|बोलने\s*में\s*दिक्कत|आधा\s*शरीर\s*सुन्न|हाथ\s*पैर\s*काम\s*नहीं)/i,
  /\b(lakwa|muh\s+tedha|aadha\s+sharir\s+sunn)\b/i,
  /(पक्षाघात|तोंड\s*वाकडे|बोलणे\s*बोबडे|हात\s*पाय\s*लुळा\s*पडला)/i,
  /\b(pakshaghat|tond\s+vakde|hat\s+pay\s+lula)\b/i,

  // Respiratory Failure / Severe Shortness of Breath
  /\b(cannot\s+breathe|gasping\s+for\s+air|lips\s+turn(ing)?\s+blue|suffocat(ing|ion)|severe\s+shortness\s+of\s+breath|oxygen\s+(saturation\s+)?.*failing|blue\s+lips)\b/i,
  /(सांस\s*नहीं\s*आ\s*रही|दम\s*घुट\s*रहा|होंठ\s*नीले\s*पड़\s*रहे)/i,
  /\b(saans\s+nahi\s+aa\s+rahi|dam\s+ghut\s+raha)\b/i,
  /(श्वास\s*घेता\s*येत\s*नाही|श्वास\s*कोंडला|ओठ\s*निळे\s*पडले)/i,
  /\b(shwas\s+gheta\s+yet\s+nahi|shwas\s+kondla)\b/i,

  // Loss of Consciousness / Seizure
  /\b(unresponsive|unconscious|collapsed|active\s+seizure|convulsion|not\s+waking\s+up)\b/i,
  /(बेहोश|मूर्छित|दौरा\s*पड़\s*रहा|उठ\s*नहीं\s*रहे)/i,
  /\b(behosh|daura\s+pad\s+raha)\b/i,
  /(बेशुद्ध|चक्कर\s*येऊन\s*पडले|झटका\s*येतोय|जागे\s*होत\s*नाहीत)/i,
  /\b(beshuddha|jhatka\s+yetoy)\b/i,

  // Massive Bleeding / Coughing Blood
  /\b(cough(ing)?\s+up\s+.*blood|vomit(ing)?\s+.*blood|severe\s+uncontrolled\s+bleeding|profuse\s+bleeding)\b/i,
  /(खून\s*की\s*उल्टी|खांसी\s*में\s*खून|बहुत\s*ज्यादा\s*खून\s*बह)/i,
  /(रक्ताची\s*उलटी|खोकल्यातून\s*रक्त|मोठ्या\s*प्रमाणात\s*रक्तस्राव)/i,
];

export interface EmergencyCheckResult {
  isEmergency: boolean;
  matchedPattern?: string;
}

export function checkClientEmergency(text: string): EmergencyCheckResult {
  if (!text || typeof text !== 'string') {
    return { isEmergency: false };
  }

  const clean = text.trim();
  for (const regex of EMERGENCY_REGEXES) {
    if (regex.test(clean)) {
      return {
        isEmergency: true,
        matchedPattern: regex.source,
      };
    }
  }

  return { isEmergency: false };
}
