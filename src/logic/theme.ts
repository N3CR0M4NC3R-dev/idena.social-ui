// index.html and public/*.html apply the stored theme with an inline script before first paint; keep the key and logic in sync with them.

export type Theme = 'light' | 'dark' | 'system';

export const defaultTheme: Theme = 'light';

const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

export const getTheme = (): Theme => {
    const theme = localStorage.getItem('theme');
    return theme === 'dark' || theme === 'system' ? theme : defaultTheme;
};

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && darkSchemeQuery.matches));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-canvas').trim());
};

export const saveTheme = (theme: Theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
};

export const initTheme = () => {
    applyTheme(getTheme());
    darkSchemeQuery.addEventListener('change', () => getTheme() === 'system' && applyTheme('system'));
};
