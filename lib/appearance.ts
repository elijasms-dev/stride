export type ThemePreference = 'light' | 'dark' | 'system';
export type Appearance = { theme: ThemePreference; motion: boolean };
const defaults: Appearance = { theme: 'system', motion: true };
export function parseTheme(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function readAppearance(storage: Pick<Storage, 'getItem'>): Appearance {
  try {
    return {
      theme: parseTheme(storage.getItem('stride-theme')),
      motion: storage.getItem('stride-motion') !== 'off',
    };
  } catch {
    return defaults;
  }
}
export function applyAppearance(
  value: Appearance,
  root = document.documentElement,
) {
  root.dataset.theme = value.theme;
  root.classList.remove('light', 'dark');
  if (value.theme !== 'system') root.classList.add(value.theme);
  root.classList.toggle('no-motion', !value.motion);
  root.dataset.accent = 'athletic';
}
/** Static script, no account data: resolve the preference before first paint. */
export const APPEARANCE_BOOTSTRAP = `(function(){var r=document.documentElement,t='system',m=true;try{var s=localStorage.getItem('stride-theme');if(s==='light'||s==='dark')t=s;m=localStorage.getItem('stride-motion')!=='off'}catch(e){}r.dataset.theme=t;r.dataset.accent='athletic';r.classList.remove('light','dark');if(t!=='system')r.classList.add(t);r.classList.toggle('no-motion',!m)})();`;
