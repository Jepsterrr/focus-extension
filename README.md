# Fokusflöde

Ett intelligent Chrome-tillägg som använder lokal, browser-baserad AI för att hjälpa dig hålla fokus på din uppgift — kontextuellt, privat och flexibelt.

---

## Innehåll
- [Bakgrund](#bakgrund)  
- [Hur det fungerar](#hur-det-funger)  
- [Kärnfunktioner](#k%C3%A4rnfunktioner)  
- [Teknisk Stack](#teknisk-stack)

---

## Bakgrund
Traditionella site-blockers är ofta för rigida — de blockerar URL:er oberoende av sammanhang. **Fokusflöde** tar istället hänsyn till kontext: samma webbplats kan vara en distraktion för en uppgift men en resurs för en annan. Tillägget analyserar innehållet på sidan mot den uppgift du angivit — allt sker lokalt i din webbläsare för maximal integritet. Ingen data lämnar din dator.

---

## Hur det fungerar
När ett fokuspass är aktivt följer tillägget en trestegsprocess för varje sida som laddas:

1. **Innehållsextraktion**  
   Skriptet plockar ut relevant text från sidan, med specialhantering för komplexa sidor (YouTube, Stack Overflow, PDF-filer etc.).

2. **AI-analys** (lokalt via Transformers.js)  
   - **Semantisk likhet:** En embedding-modell skapar numeriska representationer av sidans innehåll och jämför med din uppgift.  
   - **Nyckelordsextraktion (NER):** En NER-modell hittar viktiga termer i både uppgiften och sidan för direkta matchningar.

3. **Bedömning**  
   En viktad algoritm kombinerar modellerna. Om sidan bedöms vara irrelevant visas en overlay som uppmanar dig att återgå till arbetet.

**Integritet:** All analys körs på din maskin — inga servrar, inga externa API-anrop.

---

## Kärnfunktioner
- **Kontextuell blockering** — blockerar distraktioner baserat på innehåll, inte bara URL.  
- **Lokal AI** — all analys sker i webbläsaren; din data stannar hos dig.  
- **Fokustimer** — mät och följ dina fokuspass.  
- **Justerbar känslighet** — lägen: *Flexibel*, *Balanserad*, *Strikt*.  
- **Sessions-vitlista** — tillåt en sida temporärt under ett aktivt pass.  
- **Snooze** — ta en planerad paus (t.ex. 10 minuter).  
- **Dark Mode** — gränssnitt som följer systeminställningar.

---

## Teknisk Stack
- **Framework:** React + TypeScript  
- **Byggverktyg:** Vite  
- **AI / ML:** Transformers.js (lokala modeller)  
- **Plattform:** Chrome Extension (Manifest V3)

---

## Installation och Utveckling

### Förkrav
- Node.js v18+  
- Chrome (för testning/installation)

### Klona projektet
```bash
git clone https://github.com/Jepsterrr/focus-extension
cd ditt-repo-namn
```
