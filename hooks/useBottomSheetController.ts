import { useCallback, useState } from 'react';

export function useBottomSheetController<T extends string>(initial: T | null = null) {
  const [activeSheet, setActiveSheet] = useState<T | null>(initial);

  const openSheet = useCallback((sheet: T) => {
    setActiveSheet(sheet);
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  const isOpen = useCallback(
    (sheet: T) => activeSheet === sheet,
    [activeSheet]
  );

  return {
    activeSheet,
    openSheet,
    closeSheet,
    isOpen,
  };
}
