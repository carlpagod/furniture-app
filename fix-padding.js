const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const updated = content.replace(/paddingLeft:\s*Platform\.OS\s*===\s*'web'\s*\?\s*250\s*:\s*0/g, "paddingLeft: Platform.OS === 'web' ? 240 : 0");
      if (content !== updated) {
        fs.writeFileSync(filePath, updated);
        console.log('Updated:', filePath);
      }
    }
  });
}

walk('c:/Users/COMPUTER CENTER/Downloads/furniture-app-main/app');
