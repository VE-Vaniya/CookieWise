const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, 'extension', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).map(f => path.join(htmlDir, f));

// We'll use regex to rewrite CSS rules inside the <style> blocks or inline styles.

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Remove box-shadow and text-shadow completely
  content = content.replace(/box-shadow:\s*[^;]+;/gi, 'box-shadow: none;');
  content = content.replace(/text-shadow:\s*[^;]+;/gi, 'text-shadow: none;');

  // 2. Replace gradients with flat colors
  // Replace background: linear-gradient(...) or radial-gradient(...) with a flat background
  content = content.replace(/background:\s*(linear|radial)-gradient\([^;]+;/gi, 'background: #F5F6F8;');
  content = content.replace(/background-image:\s*(linear|radial)-gradient\([^;]+;/gi, 'background-image: none;');

  // 3. Map common hex/rgba colors to pastel ones
  // Backgrounds
  content = content.replace(/#0f1117/gi, '#F5F6F8'); // body bg
  content = content.replace(/#1a1f2e/gi, '#FFFFFF'); // header/card bg
  content = content.replace(/#12161f/gi, '#F5F6F8');
  content = content.replace(/#1e2535/gi, '#E2E8F0'); // borders
  content = content.replace(/#2a3441/gi, '#E2E8F0'); // borders/hover
  content = content.replace(/#323b4d/gi, '#D9E2EC'); // hover states

  // Accents
  content = content.replace(/#3b82f6/gi, '#AEC6CF'); // blue -> pastel blue
  content = content.replace(/#2563eb/gi, '#9CB4BD'); // darker blue -> darker pastel blue
  content = content.replace(/#60a5fa/gi, '#AEC6CF'); // light blue
  content = content.replace(/#10b981/gi, '#C1E1C1'); // green -> sage
  content = content.replace(/#059669/gi, '#A3CBA3'); // dark green
  content = content.replace(/#ef4444/gi, '#FFB6B9'); // red -> soft pink/peach-red
  content = content.replace(/#dc2626/gi, '#FFB6B9'); 
  content = content.replace(/#f59e0b/gi, '#FFDAB9'); // amber -> peach
  content = content.replace(/#d97706/gi, '#F4D0B3'); 
  content = content.replace(/#8b5cf6/gi, '#AEC6CF'); // purple -> pastel blue

  // Text colors
  content = content.replace(/#e2e8f0/gi, '#6B7A8A'); // main text
  content = content.replace(/#f8fafc/gi, '#6B7A8A'); // white text -> main text
  content = content.replace(/#94a3b8/gi, '#8A9FA8'); // secondary text
  content = content.replace(/#cbd5e1/gi, '#8A9FA8'); // secondary text
  content = content.replace(/#ffffff/gi, '#FFFFFF'); 

  // Make sure to replace any rgba with white/dark base to appropriate flat tones
  // For rgba(255,255,255,0.1), replace with a flat #F5F6F8 or #E2E8F0
  content = content.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.05\s*\)/gi, '#F5F6F8');
  content = content.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)/gi, '#E2E8F0');
  content = content.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.[0-9]+\s*\)/gi, 'transparent');
  content = content.replace(/rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*0\.[0-9]+\s*\)/gi, '#E5E9EC');

  // Change CSS variable if they exist
  content = content.replace(/--bg-base:\s*[^;]+;/gi, '--bg-base: #F5F6F8;');
  content = content.replace(/--bg-panel:\s*[^;]+;/gi, '--bg-panel: #FFFFFF;');
  content = content.replace(/--border:\s*[^;]+;/gi, '--border: #E2E8F0;');
  content = content.replace(/--text-main:\s*[^;]+;/gi, '--text-main: #6B7A8A;');
  content = content.replace(/--text-muted:\s*[^;]+;/gi, '--text-muted: #8A9FA8;');
  content = content.replace(/--accent:\s*[^;]+;/gi, '--accent: #AEC6CF;');
  content = content.replace(/--accent-hover:\s*[^;]+;/gi, '--accent-hover: #9CB4BD;');
  content = content.replace(/--success:\s*[^;]+;/gi, '--success: #C1E1C1;');
  content = content.replace(/--warning:\s*[^;]+;/gi, '--warning: #FFDAB9;');
  content = content.replace(/--danger:\s*[^;]+;/gi, '--danger: #FFB6B9;');

  // If there's any remaining pure white text (#fff or #FFF) change it to #6B7A8A if it's meant to be text.
  // We'll do a simple replace for color: #fff;
  content = content.replace(/color:\s*#fff(?:fff)?\s*;/gi, 'color: #6B7A8A;');
  // And replace background: #000; or similar
  content = content.replace(/background-color:\s*#000(?:000)?\s*;/gi, 'background-color: #F5F6F8;');
  
  // Font families update to clean
  content = content.replace(/font-family:\s*[^;]+;/gi, "font-family: 'Inter', system-ui, sans-serif;");

  fs.writeFileSync(file, content);
});
console.log('Successfully applied pastel matte lift to HTML files.');
