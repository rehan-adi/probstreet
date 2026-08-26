import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
	theme: 'light' | 'dark';
	toggleTheme: () => void;
	setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
	persist(
		(set) => ({
			theme: 'dark',
			toggleTheme: () =>
				set((state) => {
					const newTheme = state.theme === 'light' ? 'dark' : 'light';
					if (typeof document !== 'undefined') {
						if (newTheme === 'dark') {
							document.documentElement.classList.add('dark');
						} else {
							document.documentElement.classList.remove('dark');
						}
					}
					return { theme: newTheme };
				}),
			setTheme: (theme) =>
				set(() => {
					if (typeof document !== 'undefined') {
						if (theme === 'dark') {
							document.documentElement.classList.add('dark');
						} else {
							document.documentElement.classList.remove('dark');
						}
					}
					return { theme };
				}),
		}),
		{
			name: 'theme-storage',
			onRehydrateStorage: () => (state) => {
				if (typeof document !== 'undefined') {
					if (state?.theme === 'dark') {
						document.documentElement.classList.add('dark');
					} else if (state?.theme === 'light') {
						document.documentElement.classList.remove('dark');
					}
				}
			},
		},
	),
);
