# Known Limitations

The current implementation of the Grammar Cleaner is a V1 tool and has several known limitations:

1.  **Simplistic Typos**: Only a predefined list of common typos is supported. It does not use a full dictionary or language model.
2.  **Case Preservation**: Case preservation during typo correction is simplistic (checks only the first letter).
3.  **Complex Grammar**: It does not handle complex grammatical structures like subject-verb agreement, tense consistency, or advanced punctuation (semicolons, em-dashes).
4.  **Language Support**: Currently only supports English.
5.  **Ambiguity**: It may incorrectly "fix" intentional misspellings or stylized text.
6.  **Punctuation**: Always adds a period if missing, which might not be appropriate for all sentence types (e.g., questions that lack a question mark).
