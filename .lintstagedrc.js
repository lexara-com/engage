module.exports = {
  // TypeScript files
  '*.ts': [
    'eslint --fix',
    'prettier --write',
    'git add'
  ],
  
  // JSON files
  '*.json': [
    'prettier --write',
    'git add'
  ],
  
  // Markdown files (selective formatting)
  '*.md': [
    'prettier --write --prose-wrap=preserve',
    'git add'
  ],
  
  // Test files (lighter linting)
  '*.test.ts': [
    'eslint --fix --config .eslintrc.js',
    'prettier --write',
    'git add'
  ]
};