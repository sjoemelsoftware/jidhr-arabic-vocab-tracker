import { useState, useEffect } from 'react';
import { useLemmatizer } from '../context/LemmatizerContext';
import { Tooltip } from './Tooltip';

interface HighlightedWordProps {
  word: string;
  lemma: string;
  status: string;
}

const getNextStatus = (currentStatus: string): string => {
  const statusCycle = {
    new: 'known',
    known: 'learning',
    learning: 'ignored',
    ignored: 'known',
  };
  return statusCycle[currentStatus as keyof typeof statusCycle] || 'known';
};

export const HighlightedWord = ({ word, lemma, status: initialStatus }: HighlightedWordProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const { updateWordStatus, lemmaStatuses } = useLemmatizer();

  // Update status when lemmaStatuses changes
  useEffect(() => {
    const lemmaStatus = lemmaStatuses.get(lemma);
    if (lemmaStatus) {
      setCurrentStatus(lemmaStatus);
    }
  }, [lemma, lemmaStatuses]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = getNextStatus(currentStatus);
    setCurrentStatus(newStatus);
    await updateWordStatus(lemma, newStatus);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const newStatus = getNextStatus(currentStatus);
      setCurrentStatus(newStatus);
      await updateWordStatus(lemma, newStatus);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setCurrentStatus(newStatus);
    await updateWordStatus(lemma, newStatus);
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <span
      className={`arabic-lemmatizer-word ${currentStatus}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-lemma={lemma}
      data-status={currentStatus}
      role="button"
      tabIndex={0}
      aria-label={`${word} (${currentStatus})`}>
      {word}
      {showTooltip && (
        <Tooltip
          lemma={lemma}
          status={currentStatus}
          onClose={() => setShowTooltip(false)}
          onStatusChange={handleStatusChange}
        />
      )}
    </span>
  );
};
