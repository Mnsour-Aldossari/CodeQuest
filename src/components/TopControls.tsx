/** XP bar, language switch and sound toggle (shared by the level and map screens). */
import { useProgress } from '../state/progress';
import { playerLevel } from '../engine/stars';
import { useT } from '../i18n';
import { Icon } from './Icon';

export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { t, lang } = useT();
  const setLang = useProgress((s) => s.setLang);
  const color = dark ? { color: '#fff' } : undefined;
  return (
    <div className="seg" role="group" aria-label={t('lang')} style={dark ? { background: 'rgba(255,255,255,.22)' } : undefined}>
      <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')} style={lang === 'ar' && dark ? undefined : color} lang="ar">
        ع
      </button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} style={lang === 'en' && dark ? undefined : color} lang="en">
        EN
      </button>
    </div>
  );
}

export function SoundToggle({ dark = false }: { dark?: boolean }) {
  const { t } = useT();
  const on = useProgress((s) => s.settings.sound);
  const toggle = useProgress((s) => s.toggleSound);
  return (
    <button type="button" className={`btn btn-icon ${dark ? 'btn-dark' : 'btn-secondary'}`} aria-label={t('sound')} aria-pressed={on} onClick={toggle} style={{ borderRadius: 999 }}>
      <Icon name={on ? 'soundOn' : 'soundOff'} size={22} />
    </button>
  );
}

export function XpBar({ wide = false }: { wide?: boolean }) {
  const xp = useProgress((s) => s.xp);
  const lv = playerLevel(xp);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 16, background: '#fff', boxShadow: 'var(--sh-1)', minWidth: wide ? 220 : 150 }} title={`${xp} XP`}>
      <span className="ltr" style={{ fontWeight: 800, fontSize: 14, color: '#6B4300' }}>
        Lv {lv.level}
      </span>
      <div className="xp" style={{ flex: 1 }} role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into} aria-label="XP">
        <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
      </div>
    </div>
  );
}

export function TopControls({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 10 }}>
      {!compact && <XpBar wide />}
      <LangSwitch />
      {!compact && <SoundToggle />}
    </div>
  );
}
