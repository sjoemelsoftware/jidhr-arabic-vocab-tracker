import { useStorage } from '@extension/shared';
import { optionsStorage } from '@extension/storage';
import { createContext, useContext, useState, useCallback } from 'react';

interface WordInfo {
  word: string;
  lemma: string;
  status: string;
}

interface LemmatizerContextType {
  highlightedWords: Map<HTMLElement, WordInfo>;
  lemmaStatuses: Map<string, string>;
  addHighlightedWord: (element: HTMLElement, word: WordInfo) => void;
  removeHighlightedWord: (element: HTMLElement) => void;
  updateWordStatus: (lemma: string, newStatus: string) => Promise<void>;
  getWordInfo: (element: HTMLElement) => WordInfo | undefined;
}

const LemmatizerContext = createContext<LemmatizerContextType | null>(null);

export const useLemmatizer = () => {
  const context = useContext(LemmatizerContext);
  if (!context) {
    throw new Error('useLemmatizer must be used within a LemmatizerProvider');
  }
  return context;
};

export const LemmatizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [highlightedWords, setHighlightedWords] = useState<Map<HTMLElement, WordInfo>>(new Map());
  const [lemmaStatuses, setLemmaStatuses] = useState<Map<string, string>>(new Map());

  const options = useStorage(optionsStorage);

  const addHighlightedWord = useCallback(
    (element: HTMLElement, word: WordInfo) => {
      setHighlightedWords(prev => {
        const newMap = new Map(prev);
        // Use the status from lemmaStatuses if it exists, otherwise use the word's status
        const status = lemmaStatuses.get(word.lemma) || word.status;
        newMap.set(element, { ...word, status });
        return newMap;
      });

      // Update lemmaStatuses if this is a new lemma
      setLemmaStatuses(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(word.lemma)) {
          newMap.set(word.lemma, word.status);
        }
        return newMap;
      });
    },
    [lemmaStatuses],
  );

  const removeHighlightedWord = useCallback((element: HTMLElement) => {
    setHighlightedWords(prev => {
      const newMap = new Map(prev);
      newMap.delete(element);
      return newMap;
    });
  }, []);

  const updateWordStatus = useCallback(async (lemma: string, newStatus: string) => {
    try {
      const response = await fetch(`${options.backendUrl}/vocabulary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lemmas: [lemma], status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update word status');

      // Update lemmaStatuses first
      setLemmaStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(lemma, newStatus);
        return newMap;
      });

      // Then update all highlighted words with this lemma
      setHighlightedWords(prev => {
        const newMap = new Map(prev);
        for (const [element, word] of newMap.entries()) {
          if (word.lemma === lemma) {
            newMap.set(element, { ...word, status: newStatus });
          }
        }
        return newMap;
      });
    } catch (error) {
      console.error('Error updating word status:', error);
      throw error;
    }
  }, []);

  const getWordInfo = useCallback(
    (element: HTMLElement) => {
      const wordInfo = highlightedWords.get(element);
      if (wordInfo) {
        // Always return the word with its current status from lemmaStatuses
        const currentStatus = lemmaStatuses.get(wordInfo.lemma) || wordInfo.status;
        return { ...wordInfo, status: currentStatus };
      }
      return undefined;
    },
    [highlightedWords, lemmaStatuses],
  );

  const value = {
    highlightedWords,
    lemmaStatuses,
    addHighlightedWord,
    removeHighlightedWord,
    updateWordStatus,
    getWordInfo,
  };

  return <LemmatizerContext.Provider value={value}>{children}</LemmatizerContext.Provider>;
};
