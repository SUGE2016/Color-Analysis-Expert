import React from 'react';
import { Button, Dropdown, Space } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useTableCompact } from './TableWrap';

/**
 * @param {Array} actions
 * @param {object} record
 * actions: { key, label, icon?, onClick, danger?, disabled?, hidden?, pinned?, type? }
 * | { type: 'divider' }
 * pinned: true 时始终平铺显示，不参与「更多」折叠
 */
function renderActionButton(a, record) {
  const disabled = typeof a.disabled === 'function' ? a.disabled(record) : a.disabled;
  const label = typeof a.label === 'function' ? a.label(record) : a.label;
  return (
    <Button
      key={a.key}
      type={a.type || 'link'}
      size="small"
      icon={a.icon}
      danger={a.danger}
      disabled={disabled}
      onClick={() => a.onClick?.(record)}
    >
      {label}
    </Button>
  );
}

export default function TableActions({ actions, record }) {
  const compact = useTableCompact();

  const visible = actions.filter((a) => {
    if (a.type === 'divider') return true;
    if (a.hidden?.(record)) return false;
    return true;
  });

  const pinnedActions = visible.filter((a) => a.type !== 'divider' && a.pinned);
  const foldableActions = visible.filter((a) => a.type !== 'divider' && !a.pinned);

  const menuItems = foldableActions.map((a) => {
    const disabled = typeof a.disabled === 'function' ? a.disabled(record) : a.disabled;
    const label = typeof a.label === 'function' ? a.label(record) : a.label;
    return {
      key: a.key,
      icon: a.icon,
      label,
      danger: a.danger,
      disabled,
      onClick: () => a.onClick?.(record),
    };
  });

  const inlineActions = visible.filter((a) => a.type !== 'divider');

  if (compact) {
    return (
      <div className="app-table-actions-inline">
        <Space size={0} wrap={false}>
          {pinnedActions.map((a) => renderActionButton(a, record))}
          {menuItems.length > 0 && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button type="text" size="small" icon={<MoreOutlined />} aria-label="更多操作" />
            </Dropdown>
          )}
        </Space>
      </div>
    );
  }

  return (
    <div className="app-table-actions-inline">
      <Space size={0} wrap={false}>
        {inlineActions.map((a) => renderActionButton(a, record))}
      </Space>
    </div>
  );
}
