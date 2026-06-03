import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const TableCompactContext = createContext(false);

/** 表格容器宽度低于此值时，操作列折叠为「更多」菜单 */
const DEFAULT_COMPACT_BELOW = 880;

export function useTableCompact() {
  return useContext(TableCompactContext);
}

/**
 * 包裹表格区域，根据容器宽度决定是否折叠操作按钮
 */
export default function TableWrap({ children, compactBelow = DEFAULT_COMPACT_BELOW, className = '' }) {
  const ref = useRef(null);
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < compactBelow
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = (width) => setCompact(width < compactBelow);
    update(el.getBoundingClientRect().width);

    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [compactBelow]);

  return (
    <TableCompactContext.Provider value={compact}>
      <div ref={ref} className={`app-table-wrap ${className}`.trim()}>
        {children}
      </div>
    </TableCompactContext.Provider>
  );
}
