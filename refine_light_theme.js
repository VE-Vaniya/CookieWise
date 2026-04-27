const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir).map(f => path.join(dir, f));
  files.forEach(file => {
    if (file.endsWith('.html') || file.endsWith('.js')) {
      let content = fs.readFileSync(file, 'utf8');

      // 1. Remaining dark backgrounds -> light cards
      content = content.replace(/#0d1117/gi, '#FFFFFF'); // Snippet bg
      content = content.replace(/#151a27/gi, '#FFFFFF'); // Details row bg
      content = content.replace(/#0a0d14/gi, '#F5F6F8'); // Footer bg
      content = content.replace(/#0a0e1a/gi, '#FFFFFF'); // Any other dark

      // 2. Lingering dark borders and texts
      content = content.replace(/#7f1d1d/gi, '#FFB6B9'); // Dark red border -> pastel red
      content = content.replace(/#14532d/gi, '#C1E1C1'); // Dark green border -> sage
      content = content.replace(/#334155/gi, '#AEC6CF'); // Dark slate border -> pastel blue
      
      // 3. Neon colors (from scores and gauges)
      content = content.replace(/#00ff00/gi, '#4ADE80'); // Neon green -> soft readable green
      content = content.replace(/#ffff00/gi, '#FACC15'); // Neon yellow -> soft amber
      content = content.replace(/#ff0000/gi, '#F87171'); // Neon red -> soft red
      content = content.replace(/#ff6b6b/gi, '#F87171'); // Bright red -> soft red
      content = content.replace(/#ff6b00/gi, '#FB923C'); // Bright orange -> soft orange
      content = content.replace(/#ffd93d/gi, '#FCD34D'); // Bright yellow -> soft yellow
      
      // 4. Pills (vendor, keyword, multi)
      content = content.replace(/#312e81/gi, '#E0E7FF'); // Dark indigo bg -> light indigo
      content = content.replace(/#a5b4fc/gi, '#3730A3'); // Light indigo text -> dark indigo text
      content = content.replace(/#1c1f4a/gi, '#DBEAFE'); // Dark blue bg -> light blue
      content = content.replace(/#818cf8/gi, '#1E40AF'); // Light blue text -> dark blue text
      content = content.replace(/#0c2147/gi, '#E0F2FE'); // Dark sky bg -> light sky
      content = content.replace(/#7dd3fc/gi, '#0369A1'); // Light sky text -> dark sky text

      // 5. Button and header text improvements
      content = content.replace(/color:\s*white;/gi, 'color: #FFFFFF;');
      content = content.replace(/#9CB4BD22/gi, '#E2E8F0');
      content = content.replace(/#9CB4BD44/gi, '#CBD5E1');

      // 6. Dot status colors
      content = content.replace(/#22c55e/gi, '#4ADE80');
      content = content.replace(/#e53935/gi, '#F87171');
      content = content.replace(/#64748b/gi, '#94A3B8');

      // 7. General text readibility
      // Darken main text slightly for better readability on light mode
      content = content.replace(/#6B7A8A/gi, '#475569'); 

      // For data-flow-map and threat-scan which might have #f0f or #ccffff
      content = content.replace(/#f0f/gi, '#E879F9');
      content = content.replace(/#ccffff/gi, '#CFFAFE');
      content = content.replace(/#ffe6cc/gi, '#FFEDD5');
      content = content.replace(/#ffcccc/gi, '#FEE2E2');

      fs.writeFileSync(file, content);
    }
  });
}

processDir(path.join(__dirname, 'extension', 'html'));
processDir(path.join(__dirname, 'extension', 'js'));

console.log('Successfully refined light theme.');
