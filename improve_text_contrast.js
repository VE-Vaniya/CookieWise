const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir).map(f => path.join(dir, f));
  files.forEach(file => {
    if (file.endsWith('.html') || file.endsWith('.js')) {
      let content = fs.readFileSync(file, 'utf8');

      // Soften dark borders
      content = content.replace(/border(-[a-z]+)?:\s*1px\s*solid\s*#475569/gi, 'border$1: 1px solid #CBD5E1');
      
      // Fix text contrast
      content = content.replace(/color:\s*#8A9FA8/gi, 'color: #64748B'); // Muted text darker
      content = content.replace(/color:\s*#475569/gi, 'color: #334155'); // Main text darker
      content = content.replace(/color:\s*#AEC6CF/gi, 'color: #4A6C7F'); // Pastel blue text -> darker
      content = content.replace(/color:\s*#fca5a5/gi, 'color: #EF4444'); // status-text found
      content = content.replace(/color:\s*#86efac/gi, 'color: #10B981'); // status-text clear
      content = content.replace(/color:\s*#93c5fd/gi, 'color: #3B82F6'); // status-text scanning
      
      fs.writeFileSync(file, content);
    }
  });
}

processDir(path.join(__dirname, 'extension', 'html'));
processDir(path.join(__dirname, 'extension', 'js'));
console.log('Successfully refined text contrast and borders.');
