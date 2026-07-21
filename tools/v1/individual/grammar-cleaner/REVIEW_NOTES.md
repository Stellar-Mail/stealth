# Review Notes - Grammar Cleaner

## Overview

This contribution adds the core service, tests, and documentation for the Grammar Cleaner tool. The tool is designed to be contributor-friendly and remains isolated from the main application.

## Key Changes

- **Core Logic**: Implemented in `services/grammarCleaner.ts`. It handles basic capitalization, punctuation, and common typos.
- **Tests**: Comprehensive unit tests in `tests/grammarCleaner.test.ts` using local fixtures.
- **Documentation**: Detailed guides in the `docs/` folder covering setup, usage, fixtures, and limitations.
- **Isolation**: Follows the folder-local pattern with its own `vitest.config.ts` and `index.ts` API surface.

## How to Validate

1.  **Run Tests**:
    ```bash
    ./node_modules/.bin/vitest run -c tools/v1/individual/grammar-cleaner/vitest.config.ts
    ```
2.  **Verify Documentation**: Check the `README.md` and the `docs/` directory for completeness and clarity.
3.  **Inspect Code**: Ensure all changes are confined to `tools/v1/individual/grammar-cleaner/`.

## Contributor Notes

The tool is built to be easily extendable. New typos can be added to the `COMMON_TYPOS` map in `services/grammarCleaner.ts`, and corresponding fixtures should be added to `services/fixtures.ts`.
