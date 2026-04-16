import type {
  AppSettings,
  AppearanceSettings,
  AppearanceTabId,
  GeneralSettings,
  GeneralTabId,
  SettingsSectionId,
  TimerSettings,
  TimerTabId,
} from '@/domain/settings.types';
import {
  AppearanceSettingsSection,
  GeneralSettingsSection,
  SettingsTabs,
  TimerSettingsSection,
} from '@/features/settings';
import {
  APPEARANCE_TABS,
  GENERAL_TABS,
  TIMER_TABS,
} from './settings-panel.config';

interface SettingsPanelSectionProps {
  activeSection: SettingsSectionId;
  generalTab: GeneralTabId;
  timerTab: TimerTabId;
  appearanceTab: AppearanceTabId;
  onGeneralTabChange: (tab: GeneralTabId) => void;
  onTimerTabChange: (tab: TimerTabId) => void;
  onAppearanceTabChange: (tab: AppearanceTabId) => void;
  settings: AppSettings;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updateTimer: (patch: Partial<TimerSettings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
}

export function SettingsPanelSection({
  activeSection,
  generalTab,
  timerTab,
  appearanceTab,
  onGeneralTabChange,
  onTimerTabChange,
  onAppearanceTabChange,
  settings,
  updateGeneral,
  updateTimer,
  updateAppearance,
}: SettingsPanelSectionProps) {
  switch (activeSection) {
    case 'timer':
      return (
        <>
          <SettingsTabs tabs={TIMER_TABS} activeTab={timerTab} onChange={onTimerTabChange} />
          <TimerSettingsSection activeTab={timerTab} settings={settings} updateTimer={updateTimer} />
        </>
      );
    case 'appearance':
      return (
        <>
          <SettingsTabs tabs={APPEARANCE_TABS} activeTab={appearanceTab} onChange={onAppearanceTabChange} />
          <AppearanceSettingsSection activeTab={appearanceTab} settings={settings} updateAppearance={updateAppearance} />
        </>
      );
    case 'general':
    default:
      return (
        <>
          <SettingsTabs tabs={GENERAL_TABS} activeTab={generalTab} onChange={onGeneralTabChange} />
          <GeneralSettingsSection activeTab={generalTab} settings={settings} updateGeneral={updateGeneral} />
        </>
      );
  }
}

