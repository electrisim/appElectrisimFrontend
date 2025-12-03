/**
 * JavaScript Minification Script for Electrisim
 * Minifies unminified JS files identified by Lighthouse
 * Reduces payload by ~413KB according to the Lighthouse report
 * 
 * Usage: node scripts/minify-js.js
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

// Files that need minification (from Lighthouse report)
const FILES_TO_MINIFY = [
    'src/main/webapp/js/electrisim/loadflowOpenDss.js',
    'src/main/webapp/js/electrisim/loadFlow.js',
    'src/main/webapp/js/electrisim/dialogs/EditDataDialog.js',
    'src/main/webapp/js/electrisim/shortCircuit.js',
    'src/main/webapp/js/electrisim/supportingFunctions.js',
    'src/main/webapp/js/electrisim/contingencyAnalysis.js',
    'src/main/webapp/js/electrisim/optimalPowerFlow.js',
    'src/main/webapp/js/electrisim/controllerSimulation.js',
    'src/main/webapp/js/electrisim/timeSeriesSimulation.js',
    // Dialog files
    'src/main/webapp/js/electrisim/dialogs/LoadFlowDialog.js',
    'src/main/webapp/js/electrisim/dialogs/OptimalPowerFlowDialog.js',
    'src/main/webapp/js/electrisim/dialogs/ContingencyDialog.js',
    'src/main/webapp/js/electrisim/dialogs/ShortCircuitDialog.js',
    'src/main/webapp/js/electrisim/dialogs/ComponentsDataDialog.js',
    // Component dialogs
    'src/main/webapp/js/electrisim/lineBaseDialog.js',
    'src/main/webapp/js/electrisim/lineLibraryDialog.js',
    'src/main/webapp/js/electrisim/externalGridDialog.js',
    'src/main/webapp/js/electrisim/generatorDialog.js',
    'src/main/webapp/js/electrisim/staticGeneratorDialog.js',
    'src/main/webapp/js/electrisim/busDialog.js',
    'src/main/webapp/js/electrisim/transformerBaseDialog.js',
    'src/main/webapp/js/electrisim/transformerLibraryDialog.js',
    'src/main/webapp/js/electrisim/loadDialog.js',
    'src/main/webapp/js/electrisim/capacitorDialog.js',
    'src/main/webapp/js/electrisim/shuntReactorDialog.js'
];

// Terser options for minification
const TERSER_OPTIONS = {
    compress: {
        dead_code: true,
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        keep_classnames: true, // Important for ES6 classes
        keep_fnames: true, // Keep function names for better debugging
        passes: 2
    },
    mangle: {
        keep_classnames: true,
        keep_fnames: true
    },
    format: {
        comments: false, // Remove comments
        beautify: false
    },
    sourceMap: {
        filename: undefined,
        url: undefined
    },
    module: true // Support ES6 modules
};

/**
 * Minify a single file
 */
async function minifyFile(filePath) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
        console.warn(`⚠️  File not found: ${filePath}`);
        return { success: false, error: 'File not found' };
    }
    
    try {
        const code = fs.readFileSync(absolutePath, 'utf8');
        const originalSize = Buffer.byteLength(code, 'utf8');
        
        const result = await minify(code, TERSER_OPTIONS);
        
        if (result.error) {
            console.error(`❌ Error minifying ${filePath}:`, result.error);
            return { success: false, error: result.error };
        }
        
        const minifiedCode = result.code;
        const minifiedSize = Buffer.byteLength(minifiedCode, 'utf8');
        const savings = originalSize - minifiedSize;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
        
        // Create backup of original file
        const backupPath = absolutePath + '.backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(absolutePath, backupPath);
        }
        
        // Write minified file
        fs.writeFileSync(absolutePath, minifiedCode, 'utf8');
        
        console.log(`✅ ${filePath}`);
        console.log(`   Original: ${(originalSize / 1024).toFixed(2)}KB`);
        console.log(`   Minified: ${(minifiedSize / 1024).toFixed(2)}KB`);
        console.log(`   Savings:  ${(savings / 1024).toFixed(2)}KB (${savingsPercent}%)`);
        
        return {
            success: true,
            originalSize,
            minifiedSize,
            savings,
            savingsPercent: parseFloat(savingsPercent)
        };
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Restore original files from backups
 */
function restoreBackups() {
    console.log('\n🔄 Restoring original files from backups...\n');
    
    let restored = 0;
    FILES_TO_MINIFY.forEach(filePath => {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const backupPath = absolutePath + '.backup';
        
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, absolutePath);
            console.log(`✅ Restored: ${filePath}`);
            restored++;
        }
    });
    
    console.log(`\n✅ Restored ${restored} files from backups`);
}

/**
 * Delete backup files
 */
function deleteBackups() {
    console.log('\n🗑️  Deleting backup files...\n');
    
    let deleted = 0;
    FILES_TO_MINIFY.forEach(filePath => {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const backupPath = absolutePath + '.backup';
        
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            console.log(`✅ Deleted: ${filePath}.backup`);
            deleted++;
        }
    });
    
    console.log(`\n✅ Deleted ${deleted} backup files`);
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    // Handle restore command
    if (args.includes('--restore')) {
        restoreBackups();
        return;
    }

    // Handle delete-backups command
    if (args.includes('--delete-backups')) {
        deleteBackups();
        return;
    }

    // Handle single file minification
    const targetIndex = args.findIndex(arg => arg === '--target');
    if (targetIndex !== -1 && targetIndex + 1 < args.length) {
        const targetFile = args[targetIndex + 1];
        console.log('═══════════════════════════════════════════');
        console.log('🔧 ELECTRISIM JAVASCRIPT MINIFICATION (SINGLE FILE)');
        console.log('═══════════════════════════════════════════\n');

        const result = await minifyFile(targetFile);
        if (result.success) {
            console.log(`\n✅ Successfully minified: ${targetFile}`);
        } else {
            console.log(`\n❌ Failed to minify: ${targetFile}`);
            process.exit(1);
        }
        return;
    }

    console.log('═══════════════════════════════════════════');
    console.log('🔧 ELECTRISIM JAVASCRIPT MINIFICATION');
    console.log('═══════════════════════════════════════════\n');

    const results = [];
    let totalOriginal = 0;
    let totalMinified = 0;
    let successCount = 0;
    let failCount = 0;

    // Minify all files
    for (const filePath of FILES_TO_MINIFY) {
        const result = await minifyFile(filePath);
        results.push({ filePath, ...result });

        if (result.success) {
            successCount++;
            totalOriginal += result.originalSize;
            totalMinified += result.minifiedSize;
        } else {
            failCount++;
        }

        console.log(''); // Empty line between files
    }
    
    // Print summary
    const totalSavings = totalOriginal - totalMinified;
    const totalSavingsPercent = ((totalSavings / totalOriginal) * 100).toFixed(1);
    
    console.log('═══════════════════════════════════════════');
    console.log('📊 MINIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`Total Files:       ${FILES_TO_MINIFY.length}`);
    console.log(`Successful:        ${successCount}`);
    console.log(`Failed:            ${failCount}`);
    console.log(`Original Size:     ${(totalOriginal / 1024).toFixed(2)}KB`);
    console.log(`Minified Size:     ${(totalMinified / 1024).toFixed(2)}KB`);
    console.log(`Total Savings:     ${(totalSavings / 1024).toFixed(2)}KB (${totalSavingsPercent}%)`);
    console.log('═══════════════════════════════════════════\n');
    
    console.log('💡 Backups created with .backup extension');
    console.log('💡 To restore originals: node scripts/minify-js.js --restore');
    console.log('💡 To delete backups:    node scripts/minify-js.js --delete-backups\n');
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { minifyFile, restoreBackups, deleteBackups };

