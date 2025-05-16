interface TooltipProps {
  lemma: string;
  status: string;
  onClose: () => void;
  onStatusChange: (newStatus: string) => Promise<void>;
}

export const Tooltip = ({ lemma, status, onClose, onStatusChange }: TooltipProps) => {
  const handleStatusChange = async (newStatus: string) => {
    await onStatusChange(newStatus);
    onClose();
  };

  return (
    <div className="arabic-lemmatizer-tooltip">
      <div className="tooltip-content">
        <div className="tooltip-lemma">{lemma}</div>
        <div className="tooltip-status">Status: {status}</div>
        <div className="tooltip-actions">
          <button
            className={`tooltip-button known ${status === 'known' ? 'active' : ''}`}
            onClick={() => handleStatusChange('known')}>
            Known
          </button>
          <button
            className={`tooltip-button learning ${status === 'learning' ? 'active' : ''}`}
            onClick={() => handleStatusChange('learning')}>
            Learning
          </button>
          <button
            className={`tooltip-button ignored ${status === 'ignored' ? 'active' : ''}`}
            onClick={() => handleStatusChange('ignored')}>
            Ignored
          </button>
        </div>
      </div>
    </div>
  );
};
