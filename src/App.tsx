import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useRoute } from './state/nav';
import { useProgress } from './state/progress';
import { Home } from './screens/Home';
import { WorldMap } from './screens/WorldMap';
import { Bit } from './components/Bit';

const LevelScreen = lazy(() => import('./level/LevelScreen').then((m) => ({ default: m.LevelScreen })));

function Loading() {
  return (
    <div className="cq" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F6E6CA' }} aria-busy="true">
      <Bit mood="thinking" size={120} />
    </div>
  );
}

export function App() {
  const route = useRoute();
  const lang = useProgress((s) => s.settings.lang);
  const reduce = useProgress((s) => s.settings.reducedMotion);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'مغامرة الكود · Code Quest' : 'Code Quest · مغامرة الكود';
  }, [lang]);


  let screen;
  switch (route.name) {
    case 'map':
      screen = <WorldMap />;
      break;
    case 'level':
      screen = <LevelScreen id={route.id} />;
      break;
    default:
      screen = <Home />;
  }
  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
      <Suspense fallback={<Loading />}>{screen}</Suspense>
    </MotionConfig>
  );
}
