# Arabic Lemmatizer Chrome Extension

This extension helps users learn Arabic vocabulary by detecting and lemmatizing Arabic text on webpages. It allows users to interact with Arabic words, see their lemmas, and manage their vocabulary learning status.

## Features

- Detects Arabic text on any webpage
- Provides lemma information for Arabic words
- Allows users to mark words as "known", "learning", or "ignored"
- Displays tooltips with word information when hovering over highlighted words
- Synchronizes word status across all instances of the same lemma on a page

## How to Use

1. Navigate to any webpage containing Arabic text
2. Arabic paragraphs will be detected and highlighted on hover
3. Click on an Arabic paragraph to process and lemmatize its text
4. Hover over any highlighted word to see its lemma and status
5. Click on a word or use the tooltip buttons to change its learning status

## API Integration

This extension integrates with a backend API that provides lemmatization and vocabulary management services. The API endpoints used are:

- `POST /check` - Checks vocabulary status for each lemma in the text
- `PUT /vocabulary` - Updates the status of multiple lemmas in bulk
- `GET /vocabulary/{status}` - Retrieves all vocabulary entries with the specified status

## Development

The extension is built using TypeScript and follows the chrome-extension-boilerplate-react-vite project structure. The main files are:

- `arabicLemmatizer.ts` - Main class implementing the extension functionality
- `index.ts` - Entry point that initializes the extension
- `style.css` - Styles for the extension UI components 