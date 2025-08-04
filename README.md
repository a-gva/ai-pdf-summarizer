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
bun summarizer.js
```

```bash
   bun summarizer.js --target-words 1000
   bun summarizer.js --target-words 2000
   bun summarizer.js --target-words 5000
```

```bash
   bun summarizer.js --reduction-factor 0.1    # 10% of original
   bun summarizer.js --reduction-factor 0.2    # 20% of original
   bun summarizer.js --reduction-factor 0.05   # 5% of original
```
