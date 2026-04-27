const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'extension', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // content.js
  content = content.replace(/rgba\(30,\s*30,\s*30,\s*0\.9\)/g, '#FFFFFF'); // White background for injected UI
  content = content.replace(/box-shadow:\s*0\s*10px\s*30px\s*rgba\(0,0,0,0\.5\)/g, 'box-shadow: none');
  content = content.replace(/border:\s*1px\s*solid\s*rgba\(255,255,255,0\.1\)/g, 'border: 1px solid #E2E8F0');

  // dashboard-updater.js
  content = content.replace(/avg <= 30 \? '#00ff00' : avg <= 60 \? '#ffff00' : '#ff0000'/g, "avg <= 30 ? '#C1E1C1' : avg <= 60 ? '#FFDAB9' : '#FFB6B9'");
  content = content.replace(/linear-gradient\(90deg, \$\{color\}, #f0f\)/g, "${color}"); // remove gradient, just use flat color
  content = content.replace(/rgba\(0,255,255,0\.1\)/g, '#F5F6F8');
  content = content.replace(/border:1px solid cyan;/g, 'border:1px solid #E2E8F0;');
  content = content.replace(/color:cyan;/g, 'color:#6B7A8A;');
  content = content.replace(/#94a3b8/g, '#8A9FA8'); // mute text
  content = content.replace(/rgba\(255,0,0,0\.1\)/g, '#F5F6F8');
  content = content.replace(/border:1px solid #ff6b6b;/g, 'border:1px solid #FFB6B9;');
  content = content.replace(/color:#ff6b6b;/g, 'color:#FFB6B9;');
  content = content.replace(/color:\s*#00ff00;/g, 'color: #C1E1C1;');

  // background.js badge colors
  content = content.replace(/"#E53935"/g, '"#FFB6B9"');
  content = content.replace(/"#4CAF50"/g, '"#C1E1C1"');

  fs.writeFileSync(file, content);
});
console.log('Successfully applied pastel matte lift to JS files.');
