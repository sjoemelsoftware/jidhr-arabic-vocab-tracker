import { createRoot } from 'react-dom/client';
import { HighlightedWord } from './components/HighlightedWord';
import { LemmatizerProvider } from './context/LemmatizerContext';
import { optionsStorage } from '@extension/storage';

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

  constructor() {
    this.isProcessing = false;
    this.setupEventListeners();
    this.processExistingParagraphs();

    optionsStorage.subscribe(async () => {
      const options = await optionsStorage.get();
      this.backendUrl = options.backendUrl;
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

    // Skip if element is already processed or is a lemmatized word
    if (element.classList.contains('arabic-lemmatizer-word')) {
      return null;
    }

    // Check if the element or any of its parents is already lemmatized
    if (element.closest('.arabic-lemmatizer-paragraph')) {
      return null;
    }

    const textElements = ['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'LABEL'];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      // Skip if element or any of its parents is a link
      const isLink = current.tagName === 'A';
      const isLinkChild = current.closest?.('a') !== null;

      if (isLink || isLinkChild) {
        return null;
      }

      if (textElements.includes(current.tagName) && this.containsArabic(current.textContent || '')) {
        return current;
      }
      current = current.parentElement;
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
    if (!this.backendUrl) {
      console.error('Backend URL is not set');
      return null;
    }

    try {
      const response = await fetch(`${this.backendUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('API request failed');
      return (await response.json()) as CheckResult;
    } catch (error) {
      console.error('Error checking text:', error);
      return null;
    }
  }
}
