import { useState } from 'react';
import { EditorView } from './components/editor/EditorView';
import styles from './App.module.css';

type View = 'catalog' | 'editor';

export default function App() {
  const [view, setView] = useState<View>('catalog');

  return (
    <div className={styles.app}>
      {view === 'catalog' ? (
        <div className={styles.catalog}>
          <h1>Fiat Lux</h1>
          <p>RAW Photo Editor</p>
          <button onClick={() => setView('editor')}>Open Editor</button>
        </div>
      ) : (
        <EditorView onBack={() => setView('catalog')} />
      )}
    </div>
  );
}
