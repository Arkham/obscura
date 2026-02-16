import { useState } from 'react';
import styles from './App.module.css';

type View = 'catalog' | 'editor';

export default function App() {
  const [view, setView] = useState<View>('catalog');

  return (
    <div className={styles.app}>
      {view === 'catalog' ? (
        <div>
          <h1>Fiat Lux</h1>
          <button onClick={() => setView('editor')}>Open Editor</button>
        </div>
      ) : (
        <div>
          <button onClick={() => setView('catalog')}>&larr; Back</button>
          <h1>Editor</h1>
        </div>
      )}
    </div>
  );
}
