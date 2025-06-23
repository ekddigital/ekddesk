#!/usr/bin/env node

const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function convertIcon() {
    try {
        console.log('Converting PNG to ICO...');

        const inputPath = path.join(__dirname, 'assets', 'icon.png');
        const outputPath = path.join(__dirname, 'assets', 'icon.ico');

        // Check if input file exists
        if (!fs.existsSync(inputPath)) {
            console.error('Input PNG file not found:', inputPath);
            process.exit(1);
        }

        // Convert PNG to ICO with Windows-required sizes (must include 256x256)
        const buf = await pngToIco([
            inputPath
        ], {
            sizes: [16, 32, 48, 64, 128, 256]
        });

        // Write the ICO file
        fs.writeFileSync(outputPath, buf);

        console.log('✅ Successfully converted PNG to ICO:', outputPath);
        console.log('ICO file size:', fs.statSync(outputPath).size, 'bytes');

    } catch (error) {
        console.error('❌ Error converting PNG to ICO:', error);
        process.exit(1);
    }
}

convertIcon();
