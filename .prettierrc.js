module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'none',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // TypeScript specific
  parser: 'typescript',
  
  // Overrides for different file types
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        singleQuote: false
      }
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yaml',
      options: {
        parser: 'yaml',
        singleQuote: false
      }
    }
  ]
};