#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function getFileType(stats) {
    if (stats.isDirectory()) return '?? Folder';
    if (stats.isFile()) return '?? File';
    if (stats.isSymbolicLink()) return '?? Link';
    return '? Unknown';
}

function getFileColor(type) {
    if (type.includes('Folder')) return '\x1b[36m'; // Cyan
    if (type.includes('File')) return '\x1b[32m';   // Green
    return '\x1b[37m';                              // White
}

function listFiles(dir, prefix = '') {
    try {
        const items = fs.readdirSync(dir);
        let totalFiles = 0;
        let totalSize = 0;
        let fileList = [];

        for (const item of items) {
            const fullPath = path.join(dir, item);
            try {
                const stats = fs.statSync(fullPath);
                const type = getFileType(stats);
                const color = getFileColor(type);
                const size = stats.isFile() ? formatSize(stats.size) : '';

                fileList.push({
                    name: item,
                    path: fullPath,
                    type: type,
                    size: size,
                    bytes: stats.size,
                    isDirectory: stats.isDirectory(),
                    modified: stats.mtime
                });

                if (stats.isFile()) {
                    totalFiles++;
                    totalSize += stats.size;
                }

                if (stats.isDirectory()) {
                    const sub = listFiles(fullPath, prefix + '  ');
                    totalFiles += sub.totalFiles;
                    totalSize += sub.totalSize;
                }
            } catch (e) {
                // Skip files we can't access
            }
        }

        return { totalFiles, totalSize, files: fileList };
    } catch (e) {
        return { totalFiles: 0, totalSize: 0, files: [] };
    }
}

function displayFiles(fileList, maxDisplay = 50) {
    console.log('\n?? Files found:');
    console.log('========================================');
    
    let displayed = 0;
    for (const file of fileList) {
        if (displayed >= maxDisplay) {
            console.log(`... and ${fileList.length - maxDisplay} more files`);
            break;
        }
        const icon = file.isDirectory ? '??' : '??';
        const size = file.size ? ` (${file.size})` : '';
        console.log(`  ${icon} ${file.name}${size}`);
        displayed++;
    }
    
    if (fileList.length === 0) {
        console.log('  ? No files found');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const target = args[0] || '.';
    const detail = args.includes('--detail') || args.includes('-d');
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || 50);

    if (!fs.existsSync(target)) {
        console.error('? Path does not exist:', target);
        process.exit(1);
    }

    const stats = fs.statSync(target);
    
    console.log('\n??? File Viewer - Secure Vault');
    console.log('========================================');
    console.log(`?? Path: ${path.resolve(target)}`);
    console.log(`?? Type: ${stats.isDirectory() ? 'Folder' : 'File'}`);
    
    if (stats.isFile()) {
        console.log(`?? Size: ${formatSize(stats.size)}`);
        console.log(`?? Modified: ${stats.mtime.toLocaleString()}`);
        console.log('\n? This is a single file. Backup will include this file only.');
    } else if (stats.isDirectory()) {
        const result = listFiles(target);
        console.log(`?? Total Files: ${result.totalFiles}`);
        console.log(`?? Total Size: ${formatSize(result.totalSize)}`);
        console.log(`?? Subfolders: ${result.files.filter(f => f.isDirectory).length}`);
        
        console.log('\n?? Contents:');
        console.log('========================================');
        
        // Sort: folders first, then files
        const sorted = result.files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        displayFiles(sorted, limit);

        if (detail) {
            console.log('\n?? Detailed List:');
            console.log('========================================');
            for (const file of sorted) {
                const icon = file.isDirectory ? '??' : '??';
                const size = file.size ? `(${file.size})` : '';
                const modified = file.modified ? file.modified.toLocaleString() : '';
                console.log(`  ${icon} ${file.name} ${size} ${modified}`);
            }
        }
    }

    console.log('\n========================================');
    console.log('?? To create backup, run:');
    console.log(`  node src/encrypt.js "${target}"`);
    
    if (stats.isDirectory()) {
        console.log('\n?? Use --detail or -d for detailed view');
        console.log('   Example: node src/file-viewer.js "C:\\path" --detail');
        console.log('   Example: node src/file-viewer.js "C:\\path" --limit=100');
    }
}

main().catch(console.error);
