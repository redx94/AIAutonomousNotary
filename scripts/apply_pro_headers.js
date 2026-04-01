/**
 * ============================================================================
 * File:      apply_pro_headers.js
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
/**
 * ============================================================================
 * File:      apply_pro_headers.js
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

const DIRECTORIES = ['contracts', 'scripts', 'test'];

function generateSolidityHeader(filename) {
  return `// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    ${filename}
 * @author   Reece Dixon
 * @project  AI Autonomous Notary Protocol
 * @date     2026
 * 
 * @notice   Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 *           Unauthorized copying, modification, or commercial use of this file,
 *           via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
`;
}

function generateJsHeader(filename) {
  return `/**
 * ============================================================================
 * File:      ${filename}
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
`;
}

function processFile(filePath, filename) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip the existing SPDX and 4-line copyright comment
  // It handles // SPDX-License-Identifier: BUSL-1.1 followed by 4 lines of //
  const commentBlockRegex = /\/\/ SPDX-License-Identifier: BUSL-1\.1\r?\n(\/\/.*\r?\n){4}\r?\n?/g;
  content = content.replace(commentBlockRegex, '');

  content = content.replace(/^\s+/, ''); // clean leading whitespace

  let newHeader = filePath.endsWith('.sol') ? generateSolidityHeader(filename) : generateJsHeader(filename);
  
  fs.writeFileSync(filePath, newHeader + content, 'utf8');
  console.log(`Professional header applied to: ${filename}`);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.sol') || file.endsWith('.js')) {
      processFile(fullPath, file);
    }
  }
}

// Ensure the root files are handled correctly
const rootDir = path.join(__dirname, '..');
processFile(path.join(rootDir, 'hardhat.config.js'), 'hardhat.config.js');

DIRECTORIES.forEach(dir => {
  const absoluteDir = path.join(rootDir, dir);
  if (fs.existsSync(absoluteDir)) {
    walkDir(absoluteDir);
  }
});

console.log("Complete.");
