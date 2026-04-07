const fs = require('fs');
const path = require('path');
const sourceDir = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\4fdfcec4-c4eb-497e-b037-8efabb4074df';
const destDir = path.join(__dirname, '..', 'public', 'images', 'sketches');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.startsWith('romance_sketch_') && file.endsWith('.png')) {
        let cleanName = '';
        if (file.includes('embrace')) cleanName = 'romance_sketch_1_embrace.png';
        else if (file.includes('library')) cleanName = 'romance_sketch_2_library.png';
        else if (file.includes('letters')) cleanName = 'romance_sketch_3_letters.png';
        else if (file.includes('balcony')) cleanName = 'romance_sketch_4_balcony.png';
        else if (file.includes('flowers')) cleanName = 'romance_sketch_5_flowers.png';
        
        if (cleanName) {
            fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, cleanName));
            console.log(`✅ Copied ${file} to ${cleanName}`);
        }
    }
});
