import type { LocaleData } from '@vuepress/shared'
import type { ThemeData } from '@vuepress/plugin-theme-data'

export interface NavItem {
  name: string
  link: string
}

export type NavGroup = NavItem[]

export interface SocialConfig {
  github?: string
  twitter?: string
}

export type SocialGroup = SocialConfig

export interface ThemeYuchannsLocaleData extends LocaleData {
  name: string
  avatar: string
  description: string
  copyright?: string
  startDate: number
  nav: NavGroup
  social: SocialGroup
}

export type ThemeYuchannsData = ThemeData<ThemeYuchannsLocaleData>

export type ThemeYuchannsLocaleOptions = ThemeYuchannsData
