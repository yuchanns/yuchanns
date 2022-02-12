import { useThemeLocaleData as _useThemeLocaleData } from '@vuepress/plugin-theme-data/lib/client'
import type { ThemeYuchannsLocaleOptions } from '../../shared'
import type { ThemeLocaleDataRef } from '@vuepress/plugin-theme-data/lib/client'

export const useThemeLocaleData = (): ThemeLocaleDataRef<ThemeYuchannsLocaleOptions> => _useThemeLocaleData<ThemeYuchannsLocaleOptions>()
