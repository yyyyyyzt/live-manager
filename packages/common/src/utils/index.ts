/**
 * Safely parse JSON strings
 * @param str The string to be parsed
 * @param defaultValue The default value when the parsing fails
 * @returns Parse the result or default value
 */
export const safelyParse = <T = any>(str: string, defaultValue: T = null as T): T => {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('Failed to parse JSON:', str, error);
    return defaultValue;
  }
};

// Debounce utility function
export const createDebounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};

/**
 * Make the dom element fullscreen
 * @param {dom} element dom element
 * @example
 * setFullscreen(document.documentElement) // The entire page goes full screen
 * setFullscreen(document.getElementById("id")) // An element goes full screen
 */
export const setFullScreen = (element: HTMLElement, options: FullscreenOptions = {}) => {
  const fullScreenElement = element as HTMLElement & {
    mozRequestFullScreen(options: FullscreenOptions): Promise<void>;
    msRequestFullscreen(options: FullscreenOptions): Promise<void>;
    webkitRequestFullScreen(options: FullscreenOptions): Promise<void>;
  };
  if (fullScreenElement?.requestFullscreen) {
    fullScreenElement?.requestFullscreen(options);
  } else if (fullScreenElement?.mozRequestFullScreen) {
    fullScreenElement?.mozRequestFullScreen(options);
  } else if (fullScreenElement?.webkitRequestFullScreen) {
    fullScreenElement?.webkitRequestFullScreen(options);
  } else if (fullScreenElement?.msRequestFullscreen) {
    fullScreenElement?.msRequestFullscreen(options);
  }
};

/**
 * exitFullscreen
 * @example
 * exitFullscreen();
 */
export const exitFullScreen = () => {
  if (
    !document?.fullscreenElement &&
    !(document as any)?.webkitFullscreenElement &&
    !(document as any)?.mozFullScreenElement
  ) {
    return;
  }
  const exitFullScreenDocument = document as Document & {
    mozCancelFullScreen(): Promise<void>;
    msExitFullscreen(): Promise<void>;
    webkitExitFullscreen(): Promise<void>;
  };
  if (exitFullScreenDocument?.exitFullscreen) {
    exitFullScreenDocument?.exitFullscreen();
  } else if (exitFullScreenDocument?.msExitFullscreen) {
    exitFullScreenDocument?.msExitFullscreen();
  } else if (exitFullScreenDocument?.mozCancelFullScreen) {
    exitFullScreenDocument?.mozCancelFullScreen();
  } else if (exitFullScreenDocument?.webkitExitFullscreen) {
    exitFullScreenDocument?.webkitExitFullscreen();
  }
};

/**
 * 复制文本到剪贴板（兼容 HTTP 环境）
 * navigator.clipboard 仅在 HTTPS/localhost 下可用，HTTP 环境回退到 execCommand
 */
export const copyText = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

// Emoji 解析
export { BASIC_EMOJI, EMOJI_BASE_URL, parseTextWithEmoji, type EmojiSegment } from './emoji';
