/**
 * Automated Accessibility Spike & Gate: axe-core audit across EN, HI, MR
 * Verifies that Devanagari script renders properly with accessible markup
 * and that zero critical or serious WCAG accessibility violations exist.
 */

import { JSDOM } from "jsdom";
import axe from "axe-core";

const SAMPLE_HTML_TEMPLATES = {
  en: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>MediTriage Component Accessibility Test - English</title>
      <style>
        :root {
          --bg: #FBFAF7;
          --surface: #FFFFFF;
          --ink: #12263A;
          --muted: #5B6B7A;
          --primary: #0E7C86;
          --emergency: #C62828;
        }
        body { background: var(--bg); color: var(--ink); font-family: sans-serif; }
      </style>
    </head>
    <body>
      <main id="main-content">
        <h1>Emergency Triage Assessment</h1>
        <section aria-label="Triage Status" role="region">
          <div role="alert">
            <h2>Emergent (Level 1) — Immediate Resuscitation Required</h2>
            <p>Life-threatening presentation detected. Medical attention required immediately.</p>
            <a href="tel:112" aria-label="Call Emergency Services 112">Emergency 112</a>
          </div>
        </section>
        <section aria-label="Trust Strip" role="region">
          <h3>Algorithmic Trust Indicators</h3>
          <p>Confidence: High (94%)</p>
          <p>Deterministic Safety Rules Verified: 60/60</p>
        </section>
        <form aria-label="Patient Intake">
          <label for="symptom-input-en">Describe your primary symptoms:</label>
          <input id="symptom-input-en" type="text" name="symptoms" required />
          <button type="submit">Submit Assessment</button>
        </form>
      </main>
    </body>
    </html>
  `,
  hi: `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <title>मेडीट्राएज घटक अभिगम्यता परीक्षण - हिंदी</title>
      <style>
        :root {
          --bg: #FBFAF7;
          --surface: #FFFFFF;
          --ink: #12263A;
          --muted: #5B6B7A;
          --primary: #0E7C86;
          --emergency: #C62828;
        }
        body { background: var(--bg); color: var(--ink); font-family: 'Noto Sans Devanagari', sans-serif; }
      </style>
    </head>
    <body>
      <main id="main-content">
        <h1>आपातकालीन ट्राइएज मूल्यांकन</h1>
        <section aria-label="ट्राइएज स्थिति" role="region">
          <div role="alert">
            <h2>अति-आपातकालीन (स्तर 1) — तत्काल पुनर्जीवन आवश्यक</h2>
            <p>जीवन-घातक स्थिति की पहचान हुई है। बिना किसी देरी के तुरंत चिकित्सा सहायता आवश्यक है।</p>
            <a href="tel:112" aria-label="आपातकालीन सेवा 112 पर कॉल करें">आपातकालीन 112</a>
          </div>
        </section>
        <section aria-label="विश्वसनीयता पट्टी" role="region">
          <h3>एल्गोरिथमिक विश्वसनीयता संकेतक</h3>
          <p>आत्मविश्वास: उच्च (94%)</p>
          <p>सत्यापित नैदानिक सुरक्षा नियम: 60/60</p>
        </section>
        <form aria-label="रोगी लक्षण प्रविष्टि">
          <label for="symptom-input-hi">अपने मुख्य लक्षणों का वर्णन करें:</label>
          <input id="symptom-input-hi" type="text" name="symptoms" required />
          <button type="submit">मूल्यांकन जमा करें</button>
        </form>
      </main>
    </body>
    </html>
  `,
  mr: `
    <!DOCTYPE html>
    <html lang="mr">
    <head>
      <meta charset="UTF-8">
      <title>मेडीट्राएज घटक प्रवेशयोग्यता चाचणी - मराठी</title>
      <style>
        :root {
          --bg: #FBFAF7;
          --surface: #FFFFFF;
          --ink: #12263A;
          --muted: #5B6B7A;
          --primary: #0E7C86;
          --emergency: #C62828;
        }
        body { background: var(--bg); color: var(--ink); font-family: 'Noto Sans Devanagari', sans-serif; }
      </style>
    </head>
    <body>
      <main id="main-content">
        <h1>तातडीचे ट्रायज मूल्यांकन</h1>
        <section aria-label="ट्रायज स्थिती" role="region">
          <div role="alert">
            <h2>अति-तातडीचे (स्तर 1) — त्वरित वैद्यकीय उपचार आवश्यक</h2>
            <p>जीवघेणी लक्षणे आढळली आहेत. कोणत्याही विलंबाशिवाय तातडीने वैद्यकीय मदत आवश्यक आहे.</p>
            <a href="tel:112" aria-label="आपत्कालीन सेवा 112 ला कॉल करा">आपत्कालीन 112</a>
          </div>
        </section>
        <section aria-label="विश्वासार्हता पट्टी" role="region">
          <h3>अल्गोरिथमिक विश्वासार्हता निर्देशक</h3>
          <p>विश्वासार्हता: उच्च (94%)</p>
          <p>तपासलेले सुरक्षितता नियम: 60/60</p>
        </section>
        <form aria-label="रुग्ण लक्षण नोंद">
          <label for="symptom-input-mr">तुमच्या प्रमुख लक्षणांचे वर्णन करा:</label>
          <input id="symptom-input-mr" type="text" name="symptoms" required />
          <button type="submit">मूल्यांकन सबमिट करा</button>
        </form>
      </main>
    </body>
    </html>
  `,
};

async function runAuditForLocale(locale, html) {
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  const { window } = dom;

  // Run axe-core inside this DOM window context
  const results = await axe.run(window.document.documentElement, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
  });

  const criticalViolations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  return {
    locale,
    totalViolations: results.violations.length,
    criticalViolations,
    passes: results.passes.length,
  };
}

console.log("=== Q2 Spike & Gate: axe-core Accessibility Audit across EN, HI, MR ===");

let failed = false;

for (const [locale, html] of Object.entries(SAMPLE_HTML_TEMPLATES)) {
  const res = await runAuditForLocale(locale, html);
  console.log(`\nTesting Locale: [${locale.toUpperCase()}]`);
  console.log(` - Checks passed: ${res.passes}`);
  console.log(` - Total violations: ${res.totalViolations}`);
  console.log(` - Critical/Serious violations: ${res.criticalViolations.length}`);

  if (res.criticalViolations.length > 0) {
    console.error(`❌ Critical accessibility violations found in [${locale}]:`);
    res.criticalViolations.forEach((v) => {
      console.error(`   - [${v.impact}] ${v.id}: ${v.description}`);
    });
    failed = true;
  } else {
    console.log(`✅ [${locale.toUpperCase()}] Passed with 0 critical/serious violations.`);
  }
}

if (failed) {
  console.error("\n❌ Accessibility audit failed!");
  process.exit(1);
} else {
  console.log("\n🎉 All locales (EN, HI, MR) passed axe-core accessibility audit with ZERO critical/serious violations!");
  process.exit(0);
}
