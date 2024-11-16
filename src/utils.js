// Utility functions for the extension

// Debounce function to limit the rate at which a function is called
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Format time from seconds to HH:MM:SS
export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(String(hrs).padStart(2, '0'));
  parts.push(String(mins).padStart(2, '0'));
  parts.push(String(secs).padStart(2, '0'));
  
  return parts.join(':');
};

// Show notification
export const showNotification = (message, type = 'success') => {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? 'rgba(22, 163, 74, 0.9)' : 'rgba(220, 38, 38, 0.9)'};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 9999;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    pointer-events: none;
    animation: fadeInOut 2s ease-in-out;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  notification.innerHTML = `${type === 'success' ? '✓' : '✕'} ${message}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
};

// Lazy load images using IntersectionObserver
export const setupLazyLoading = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  });

  return observer;
};
