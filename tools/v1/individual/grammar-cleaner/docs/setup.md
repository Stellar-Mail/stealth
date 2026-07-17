# Setup Instructions

To set up the Grammar Cleaner tool for development and testing:

1.  **Install Dependencies**: Ensure you have installed the project dependencies from the root directory.

    ```bash
    npm install
    ```

2.  **Verify Tool Structure**: The tool is located in `tools/v1/individual/grammar-cleaner/`. Ensure all subdirectories (`services`, `tests`, `docs`, `components`, `hooks`) are present.

3.  **Run Tests**: Use the local Vitest configuration to run the tests for this tool specifically.
    ```bash
    ./node_modules/.bin/vitest run -c tools/v1/individual/grammar-cleaner/vitest.config.ts
    ```
