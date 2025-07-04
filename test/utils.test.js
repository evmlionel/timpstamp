import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  debounce,
  formatTime,
  setupLazyLoading,
  showNotification,
} from '../src/utils.js';

describe('Utils', () => {
  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');

      expect(mockFn).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test3');
    });
  });

  describe('formatTime', () => {
    it('should format seconds to MM:SS format', () => {
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(125)).toBe('02:05');
    });

    it('should format seconds to HH:MM:SS format for longer durations', () => {
      expect(formatTime(3665)).toBe('01:01:05');
      expect(formatTime(7325)).toBe('02:02:05');
    });

    it('should handle zero seconds', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('should handle edge cases', () => {
      expect(formatTime(59)).toBe('00:59');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(3600)).toBe('01:00:00');
    });
  });

  describe('showNotification', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create success notification', () => {
      showNotification('Test message', 'success');

      const notification = document.querySelector('div');
      expect(notification).toBeTruthy();
      expect(notification.innerHTML).toContain('✓ Test message');
      expect(notification.style.background).toContain('rgba(22, 163, 74, 0.9)');
    });

    it('should create error notification', () => {
      showNotification('Error message', 'error');

      const notification = document.querySelector('div');
      expect(notification).toBeTruthy();
      expect(notification.innerHTML).toContain('✕ Error message');
      expect(notification.style.background).toContain('rgba(220, 38, 38, 0.9)');
    });

    it('should remove notification after timeout', () => {
      showNotification('Test message');

      expect(document.querySelector('div')).toBeTruthy();

      vi.advanceTimersByTime(2100);

      expect(document.querySelector('div')).toBeFalsy();
    });
  });

  describe('setupLazyLoading', () => {
    it('should return an IntersectionObserver', () => {
      const observer = setupLazyLoading();
      expect(observer).toBeDefined();
      expect(IntersectionObserver).toHaveBeenCalled();
    });
  });
});
