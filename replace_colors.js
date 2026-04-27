const fs = require('fs');

const files = [
  'C:\\Users\\aykai\\Desktop\\projects+ works\\Doppleganger\\frontend\\src\\components\\invitation\\InvitePreview.jsx',
  'C:\\Users\\aykai\\Desktop\\projects+ works\\Doppleganger\\frontend\\src\\pages\\Landing.jsx',
  'C:\\Users\\aykai\\Desktop\\projects+ works\\Doppleganger\\frontend\\src\\App.css'
];

const colorMap = {
  '#5C1A2E': '#AEC6CF',
  '#7B2340': '#9CB4BD',
  '#8B1A4A': '#8A9FA8',
  '#C47D3E': '#FFDAB9',
  '#D4A849': '#F4D0B3',
  '#C9A84C': '#F4D0B3',
  '#E8D5A3': '#E5E9EC',
  '#F5EDD8': '#F5F6F8',
  '#FAF7F2': '#FFFFFF',
  '#2C1810': '#6B7A8A',
  '#3D1A0F': '#6B7A8A',
  '#5A3825': '#8493A3',
  '#8B6B52': '#A0AFBF',
  '#2C0D18': '#6B7A8A',
  '#3D0B1A': '#AEC6CF',
  '#FAF7F0': '#FFFFFF',
  '#F0E8D4': '#F5F6F8',
};

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace hex colors (case insensitive)
  for (const [oldHex, newHex] of Object.entries(colorMap)) {
    const regex = new RegExp(oldHex, 'gi');
    content = content.replace(regex, newHex);
  }
  
  // Replace specific gradients
  content = content.replace(/linear-gradient\([^,]+,\s*#AEC6CF\s*0%,\s*#AEC6CF\s*40%,\s*#9CB4BD\s*100%\)/gi, '#AEC6CF');
  content = content.replace(/linear-gradient\(135deg,\s*#9CB4BD,\s*#AEC6CF\)/gi, '#AEC6CF');
  content = content.replace(/linear-gradient\(135deg,\s*#F4D0B3,\s*#FFDAB9\)/gi, '#FFDAB9');
  content = content.replace(/linear-gradient\(160deg,\s*#FFFFFF,\s*#F5F6F8\)/gi, '#F5F6F8');
  content = content.replace(/linear-gradient\(to\s+right,\s*transparent,\s*#F4D0B3\)/gi, 'transparent');
  content = content.replace(/linear-gradient\(to\s+left,\s*transparent,\s*#F4D0B3\)/gi, 'transparent');
  content = content.replace(/linear-gradient\(to\s+right,\s*#AEC6CF,\s*#F4D0B3,\s*#AEC6CF\)/gi, '#AEC6CF');
  content = content.replace(/linear-gradient\(to\s+right,\s*#9CB4BD,\s*#F4D0B3,\s*#FFDAB9,\s*#F4D0B3,\s*#9CB4BD\)/gi, '#AEC6CF');

  // Any remaining linear-gradient with hardcoded values to flat none
  content = content.replace(/background:\s*'linear-gradient\([^)]+\)'/gi, "background: 'none'");
  content = content.replace(/background:'linear-gradient\([^)]+\)'/gi, "background:'none'");
  
  // Eliminate boxShadow
  content = content.replace(/boxShadow:\s*'[^']+'/gi, "boxShadow: 'none'");
  content = content.replace(/boxShadow:'[^']+'/gi, "boxShadow:'none'");
  content = content.replace(/box-shadow:\s*[^;]+;/gi, "");
  
  fs.writeFileSync(file, content);
});
