## Summarize PDFs with RAG

### Setup

Install dependencies

```bash
npm install
```

Install Ollama

```bash
https://ollama.com/
```

### Usage

```bash
node summarizer.js
```

```bash
   node summarizer.js --target-words 1000
   node summarizer.js --target-words 2000
   node summarizer.js --target-words 5000
```

```bash
 node summarizer.js --reduction-factor 0.1    # 10% of original
   node summarizer.js --reduction-factor 0.2    # 20% of original
   node summarizer.js --reduction-factor 0.05   # 5% of original
```
