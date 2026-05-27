const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const updated = content.replace(/,\s*paddingLeft:\s*Platform\.OS\s*===\s*'web'\s*\?\s*240\s*:\s*0/g, '');
      if (content !== updated) {
        fs.writeFileSync(filePath, updated);
        console.log('Removed padding from:', filePath);
      }
    }
  });
}

walk('c:/Users/COMPUTER CENTER/Downloads/furniture-app-main/app');
