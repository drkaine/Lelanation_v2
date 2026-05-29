const path = require('path')

module.exports = {
  'frontend/**/*.{ts,vue,js}': (filenames) => {
    // Get the project root directory (where lint-staged runs from)
    const projectRoot = process.cwd()
    const frontendDir = path.join(projectRoot, 'frontend')
    const eslintConfig = path.join(frontendDir, '.eslintrc.cjs')
    
    // Convert absolute paths to relative paths from frontend directory
    const relativeFiles = filenames.map(f => {
      // Extract relative path from frontend/ directory
      const normalizedPath = f.replace(/\\/g, '/')
      const match = normalizedPath.match(/frontend\/(.+)$/)
      if (match) {
        return match[1]
      }
      // If it's an absolute path, make it relative to frontend
      return path.relative(frontendDir, f).replace(/\\/g, '/')
    })
    
    // Build commands - use subshell to ensure proper PATH and plugin resolution
    const filesArg = relativeFiles.map(f => `"${f}"`).join(' ')
    
    return [
      // Run ESLint from frontend directory
      `bash -c 'cd "${frontendDir}" && npx eslint --config .eslintrc.cjs --fix ${filesArg}'`,
      // Run Prettier from frontend directory (needs to be in frontend/ for plugin resolution)
      `bash -c 'cd "${frontendDir}" && npx prettier --write ${filesArg}'`
    ]
  },
  'backend/**/*.ts': (filenames) => {
    const projectRoot = process.cwd()
    const backendDir = path.join(projectRoot, 'backend')
    const normalized = filenames.map((f) => f.replace(/\\/g, '/'))

    const touchesSrc = normalized.some((f) => f.includes('/backend/src/'))
    const touchesUnitTests = normalized.some(
      (f) => f.includes('/backend/tests/') && !f.includes('/integration/'),
    )

    // Skip hook when only live integration tests are staged (they require RIOT_API_KEY).
    if (!touchesSrc && !touchesUnitTests) {
      return []
    }

    return [
      `bash -c 'cd "${backendDir}" && npm run typecheck'`,
    ]
  }
}
