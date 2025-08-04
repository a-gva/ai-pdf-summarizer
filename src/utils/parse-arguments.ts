export function parseArguments() {
  const args = process.argv.slice(2);
  let targetWords: number | null = null;
  let reductionFactor: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target-words' && args[i + 1]) {
      targetWords = parseInt(args?.[i + 1] || '');
      i++;
    } else if (args[i] === '--reduction-factor' && args[i + 1]) {
      reductionFactor = parseFloat(args?.[i + 1] || '');
      i++;
    } else if (args[i] === '--help') {
      console.log(`
    Usage: node summarizer.js [options]
    
    Options:
      --target-words <number>     Target word count for summary (e.g., 1000, 2000, 5000)
      --reduction-factor <float>  Reduction factor (0.1 = 10%, 0.2 = 20%, etc.)
      --help                      Show this help message
    
    Examples:
      node summarizer.js --target-words 1000
      node summarizer.js --reduction-factor 0.1
      node summarizer.js --target-words 2000
          `);
      process.exit(0);
    }
  }

  return { targetWords, reductionFactor };
}
