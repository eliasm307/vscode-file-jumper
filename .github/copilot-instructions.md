# VSCode File Jumper Extension
File Jumper is a TypeScript-based VSCode extension that enables intelligent navigation between related files in your workspace. It detects and helps you quickly jump to associated files based on user-defined rules, making development workflows more efficient.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- Bootstrap, build, and test the repository:
  - `npm install` -- takes 21 seconds to complete. NEVER CANCEL. Set timeout to 60+ minutes.
  - `npm run typecheck` -- takes 1.4 seconds. Validates TypeScript types without compilation.
  - `npm run lint` -- takes 5 seconds. Runs ESLint with auto-fix, reports warnings but should have no errors.
  - `npm run compile` -- takes 1.5 seconds. Compiles TypeScript to JavaScript in `out/` directory.
  - `npm run build` -- takes 0.3 seconds. Creates production bundle using esbuild in `out/main.js`.
  - `npm run sync-config` -- takes 4 seconds. Generates configuration docs and types from package.json.

- Full build pipeline (development workflow):
  - `npm run sync-config && npm run lint && npm run build` -- takes 10 seconds total. NEVER CANCEL.
  
- Testing (NOTE: Some tests currently fail due to unrelated existing issues):
  - `npm run test` -- takes 1-2 seconds to run vitest tests. Has 6 failing tests in FileType.test.ts that are pre-existing.
  - Skip test failures in FileType.test.ts - these are unrelated existing issues with path creation validation.

## Validation
- Always run `npm run typecheck` before making TypeScript changes to catch type errors early.
- Always run `npm run lint` before committing - the linter auto-fixes issues and should report only warnings, no errors.
- Always build with `npm run build` after code changes to ensure the extension bundles correctly.
- Test the extension by running F5 in VSCode to open Extension Development Host for manual testing.
- You can build and run the extension locally, but cannot interact with VSCode UI through automation.

## Common Tasks
The following are outputs from frequently run commands. Reference them instead of viewing, searching, or running bash commands to save time.

### Repository Structure
```
/home/runner/work/vscode-file-jumper/vscode-file-jumper/
├── .eslintrc.js             # ESLint configuration using @eliasm307/config
├── .prettierrc.cjs          # Prettier configuration
├── package.json             # Main project config with scripts and dependencies
├── tsconfig.json            # Base TypeScript configuration
├── tsconfig.build.json      # Build-specific TypeScript configuration
├── vite.config.mts          # Vitest testing configuration
├── src/                     # Source code (35 TypeScript files)
│   ├── extension.ts         # Main extension entry point
│   ├── classes/             # Core classes (LinkManager, FileType, Logger)
│   ├── utils/               # Utility functions and configuration handling
│   ├── vscode/              # VSCode-specific integrations and commands
│   ├── types/               # TypeScript type definitions
│   ├── scripts/             # Build and maintenance scripts
│   └── test/                # Test files (10 test files using vitest)
├── out/                     # Compiled output directory
│   └── main.js              # Bundled extension (29.2kb minified)
├── images/                  # Extension icons and documentation GIFs
├── CONFIGURATION.md         # Generated configuration documentation
├── README.md                # User documentation with examples
└── .vscode/                 # VSCode workspace configuration
```

### Key Source Files
- `src/extension.ts` - Main extension activation and setup
- `src/classes/LinkManager.ts` - Core file linking logic
- `src/classes/FileType.ts` - File type pattern matching and creation
- `src/utils/config.ts` - Configuration validation and processing
- `src/vscode/utils.ts` - VSCode API integration utilities

### npm Scripts Summary
- `npm run compile` - TypeScript compilation (1.5s)
- `npm run build` - Production bundle with esbuild (0.3s)
- `npm run test` - Run vitest tests (1-2s, has 6 failing tests)
- `npm run lint` - ESLint with auto-fix (5s)
- `npm run typecheck` - Type checking only (1.4s)
- `npm run sync-config` - Generate docs and types (4s)
- `npm run vscode:package` - Create .vsix package (fails due to test failures)

### Common File Locations
- Extension manifest: `package.json` (contains VSCode extension configuration)
- Main entry point: `src/extension.ts`
- Configuration schema: `package.json` contributes.configuration section
- Generated types: `src/types/config.generated.ts`
- Test files: `src/**/*.test.ts` (vitest format)
- Build output: `out/main.js` (bundled with esbuild)

### Development Environment
- Node.js v20.19.4
- TypeScript 5.3.3
- ESLint 8.56.0 with @eliasm307/config
- Vitest 1.2.2 for testing
- esbuild 0.20.0 for bundling
- VSCode Engine compatibility: ^1.79.0

### Important Notes
- Do NOT run `npm run vscode:package` or `npm run vscode:prepublish` as they fail due to existing test failures in FileType.test.ts.
- The extension uses RegEx patterns for file matching, making it flexible for complex project structures.
- Configuration is stored in VSCode settings under the `fileJumper.*` namespace.
- The extension watches file system changes and updates links automatically.
- Icons and decorations are shown in the file explorer to indicate linked files.

### Known Issues
- FileType.test.ts has 6 failing tests related to path creation validation - these are existing issues.
- React-related warnings in ESLint output can be ignored (extension doesn't use React).
- Some TypeScript linting warnings exist but do not prevent building.

### Build Troubleshooting
- If TypeScript compilation fails, check `npm run typecheck` first.
- If ESLint fails, run `npm run lint` to auto-fix issues.
- If esbuild fails, check for syntax errors in TypeScript files.
- If sync-config fails, check package.json schema validity.