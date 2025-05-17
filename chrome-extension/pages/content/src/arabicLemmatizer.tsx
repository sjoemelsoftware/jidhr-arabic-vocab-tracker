import { createRoot } from 'react-dom/client';
import { HighlightedWord } from './components/HighlightedWord';
import { LemmatizerProvider } from './context/LemmatizerContext';
import { optionsStorage } from '@extension/storage';
import { fetchApi } from './utils/apiUtils';

interface WordInfo {
  word: string;
  lemma: string;
  status: string;
}

interface CheckResult {
  lemmatized_text: string;
  words: WordInfo[];
}

export class ArabicLemmatizer {
  private isProcessing: boolean;
  private backendUrl?: string;
  private apiToken?: string;

  constructor() {
    this.isProcessing = false;
    this.setupEventListeners();
    this.processExistingParagraphs();

    optionsStorage.subscribe(async () => {
      const options = await optionsStorage.get();
      this.backendUrl = options.backendUrl;
      this.apiToken = options.apiToken;
    });
  }

  private setupEventListeners(): void {
    document.addEventListener('mouseover', e => {
      const element = this.findArabicElement(e.target as HTMLElement);
      if (
        element &&
        !element.classList.contains('arabic-lemmatizer-paragraph') &&
        !element.classList.contains('arabic-lemmatizer-paragraph-hover')
      ) {
        element.classList.add('arabic-lemmatizer-paragraph-hover');
      }
    });

    document.addEventListener('mouseout', e => {
      const element = this.findArabicElement(e.target as HTMLElement);
      if (element && !element.classList.contains('arabic-lemmatizer-paragraph')) {
        element.classList.remove('arabic-lemmatizer-paragraph-hover');
      }
    });

    document.addEventListener('click', async e => {
      const element = this.findArabicElement(e.target as HTMLElement);
      if (element && !element.classList.contains('arabic-lemmatizer-paragraph')) {
        await this.processParagraph(element);
      }
    });
  }

  private findArabicElement(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;

    const textElements = ['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'LABEL'];
    const isAlreadyWord = element.classList.contains('arabic-lemmatizer-word');
    const isInsideProcessedParagraph = element.closest('.arabic-lemmatizer-paragraph');
    const isInsideLink = element.closest('a');

    if (isAlreadyWord || isInsideProcessedParagraph || isInsideLink) {
      return null;
    }

    // Start checking from the element and walk up
    let current: HTMLElement | null = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (!textElements.includes(current.tagName)) {
        current = current.parentElement;
        continue;
      }

      const hasDirectArabic =
        this.containsArabic(current.textContent || '') &&
        Array.from(current.childNodes).every(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            return true; // allow direct text
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            return !this.containsArabic((node as HTMLElement).textContent || '');
          }
          return true;
        });

      if (hasDirectArabic) {
        return current;
      }

      // Stop walking up if current is in textElements but no Arabic in immediate structure
      break;
    }

    return null;
  }

  private containsArabic(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }

  private async processParagraph(element: HTMLElement): Promise<void> {
    if (this.isProcessing) {
      console.log('Another lemmatization request is in progress');
      return;
    }

    try {
      this.isProcessing = true;
      const text = element.textContent || '';
      const result = await this.checkText(text);

      if (result && result.words && result.words.length > 0) {
        element.classList.add('arabic-lemmatizer-paragraph');
        element.classList.remove('arabic-lemmatizer-paragraph-hover');

        // Create a temporary container and React root
        const container = document.createElement('div');
        let currentText = text;

        // Create an array to hold React elements and text nodes
        const nodes: (string | WordInfo)[] = [];

        result.words.forEach(word => {
          const index = currentText.indexOf(word.word);
          if (index === -1) return;

          if (index > 0) {
            nodes.push(currentText.slice(0, index));
          }

          nodes.push(word);
          currentText = currentText.slice(index + word.word.length);
        });

        if (currentText.length > 0) {
          nodes.push(currentText);
        }

        // Create React root and render
        const root = createRoot(container);
        root.render(
          <LemmatizerProvider>
            {nodes.map((node, index) =>
              typeof node === 'string' ? (
                node
              ) : (
                <HighlightedWord key={index} word={node.word} lemma={node.lemma} status={node.status} />
              ),
            )}
          </LemmatizerProvider>,
        );

        // Replace element content
        element.textContent = '';
        element.appendChild(container);
      }
    } catch (error) {
      console.error('Error processing paragraph:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private processExistingParagraphs(): void {
    const elements = document.querySelectorAll<HTMLElement>('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, label');

    elements.forEach(element => {
      // Skip if element or any of its parents is already lemmatized
      if (this.containsArabic(element.textContent || '') && !element.closest('.arabic-lemmatizer-paragraph')) {
        element.classList.add('arabic-lemmatizer-paragraph-candidate');
      }
    });
  }

  private async checkText(text: string): Promise<CheckResult | null> {
    return fetchApi<CheckResult>({
      url: `${this.backendUrl}/check`,
      method: 'POST',
      body: { text },
      apiToken: this.apiToken,
      defaultErrorMessage: 'Failed to process text',
    });
  }
}
