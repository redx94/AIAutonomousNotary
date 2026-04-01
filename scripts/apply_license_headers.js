/**
 * ============================================================================
 * File:      apply_license_headers.js
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const HEADER_TEXT = ``;

const DIRECTORIES = ['contracts', 'scripts', 'test'];

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if it already has the BUSL header
  if (content.includes('SPDX-License-Identifier: BUSL-1.1')) {
    return;
  }

  // Remove existing MIT or UNLICENSED headers if present
  let newContent = content.replace(/\/\/ SPDX-License-Identifier: .*[\r\n]+/g, '');
  newContent = newContent.replace(/\/\/ Copyright .*[\r\n]+/g, '');
  
  // Add the new header to the top
  newContent = HEADER_TEXT + '\n' + newContent.replace(/^\s+/, '');
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Updated: ${filePath}`);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.sol') || file.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

console.log("Starting License Header Injection...");
DIRECTORIES.forEach(dir => {
  const absoluteDir = path.join(__dirname, '..', dir);
  if (fs.existsSync(absoluteDir)) {
    walkDir(absoluteDir);
  } else {
    console.warn(`Directory not found: ${absoluteDir}`);
  }
});
console.log("Complete.");
