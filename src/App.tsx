import { useState, useCallback } from 'react';
import { CatalogView } from './components/catalog/CatalogView';
import { EditorView } from './components/editor/EditorView';
import { ToastContainer } from './components/Toast';
import styles from './App.module.css';

type View = 'catalog' | 'editor';

export default function App() {
  const [view, setView] = useState<View>('catalog');

  const handleOpenEditor = useCallback((_index: number) => {
    setView('editor');
  }, []);

  return (
    <div className={styles.app}>
      {view === 'catalog' ? (
        <CatalogView onOpenEditor={handleOpenEditor} />
      ) : (
        <EditorView onBack={() => setView('catalog')} />
      )}
      <ToastContainer />
    </div>
  );
}
