import TableActions from '../components/table/TableActions';

/**
 * 生成冻结在右侧的操作列（配合 TableWrap + table-global.css）
 */
export function buildActionColumn({
  title = '操作',
  width = 200,
  actions,
}) {
  return {
    title,
    key: 'action',
    fixed: 'right',
    width,
    className: 'app-table-action-col',
    onHeaderCell: () => ({ className: 'app-table-action-col' }),
    onCell: () => ({ className: 'app-table-action-col' }),
    render: (_, record) => <TableActions actions={actions} record={record} />,
  };
}

/** 表格横向滚动，保证 fixed 列生效 */
export const TABLE_SCROLL_X = 'max-content';
