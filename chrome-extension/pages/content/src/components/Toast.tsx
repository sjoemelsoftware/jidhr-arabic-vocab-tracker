import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ToastProps {
  title: string;
  message: string;
  duration?: number;
  type?: 'error' | 'info' | 'success';
}

export const Toast = ({ title, message, duration = 3000, type = 'error' }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: type === 'error' ? '#ff4444' : type === 'success' ? '#00C851' : '#33b5e5',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '4px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 10000,
        maxWidth: '400px',
        animation: 'slideIn 0.3s ease-out',
        direction: 'ltr',
      }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
      <div>{message}</div>
    </div>
  );
};

export const showToast = (props: ToastProps) => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<Toast {...props} />);

  // Clean up after animation
  setTimeout(
    () => {
      document.body.removeChild(container);
    },
    (props.duration || 3000) + 300,
  ); // Add 300ms for animation
};

// Add the animation to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

export default Toast;
