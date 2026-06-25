import React from "react";
import { colors, styles } from "../common/constants";

const Sidebar = ({ activeKey = "analysis" }) => {
  const sidebarStyles = {
    sidebar: {
      width: 180,
      background: colors.white,
      borderRight: `1px solid ${colors.neutralDark}`,
      padding: "14px 10px",
      boxSizing: "border-box",
    },
    menuItem: {
      height: 38,
      display: "flex",
      alignItems: "center",
      padding: "0 10px",
      borderRadius: styles.borderRadius.sm,
      color: colors.textPrimary,
      fontSize: styles.fontSize.sm,
      cursor: "pointer",
      userSelect: "none",
    },
    menuItemActive: { background: colors.primaryLight, color: colors.primary, fontWeight: 700 },
  };

  // 菜单配置
  const menuList = [
    { key: "dataset", label: "📁 数据集管理" },
    { key: "analysis", label: "📊 项目分析" },
    { key: "tool", label: "🧰 工具箱" },
    { key: "setting", label: "⚙️ 设置" },
  ];

  return (
    <div style={sidebarStyles.sidebar}>
      {menuList.map((item) => (
          <div
            key={item.key}
            style={{
              ...sidebarStyles.menuItem,
              ...(activeKey === item.key ? sidebarStyles.menuItemActive : {}),
            }}
          >
            {item.label}
          </div>
      ))}
    </div>
  );
};

export default Sidebar;