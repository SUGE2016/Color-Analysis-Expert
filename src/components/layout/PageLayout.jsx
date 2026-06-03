import React, { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  DatabaseOutlined,
  BarChartOutlined,
  ToolOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Topbar from "./Topbar";
import layout from "../../styles/page-layout.module.css";

const MOBILE_MAX = 767;

/** 菜单文案统一为四字，便于侧栏对齐 */
const menuItems = [
  { key: "dataset", label: "数据管理", Icon: DatabaseOutlined, path: "/dataset" },
  { key: "analysis", label: "项目分析", Icon: BarChartOutlined, path: "/analysis" },
  { key: "toolbox", label: "工具中心", Icon: ToolOutlined, path: "/toolbox" },
  { key: "settings", label: "系统设置", Icon: SettingOutlined, path: "/settings" },
];

function useMobileSidebar() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export default function PageLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobileSidebar();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getActiveKey = () => {
    const currentPath = location.pathname;
    const matchItem = menuItems.find((item) => currentPath.includes(item.key));
    return matchItem?.key || "dataset";
  };

  const activeKey = getActiveKey();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  useEffect(() => {
    if (!isMobile) closeSidebar();
  }, [isMobile, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen, isMobile, closeSidebar]);

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) closeSidebar();
  };

  return (
    <div className={layout.page}>
      <Topbar
        username="管理员"
        avatarText="A"
        showMenuButton={isMobile}
        onMenuClick={toggleSidebar}
        menuExpanded={sidebarOpen}
      />

      <div className={layout.body}>
        {isMobile && sidebarOpen && (
          <button
            type="button"
            className={layout.backdropVisible}
            aria-label="关闭菜单"
            onClick={closeSidebar}
          />
        )}

        <aside
          className={`${layout.sidebar} ${isMobile && sidebarOpen ? layout.sidebarOpen : ""}`}
          aria-hidden={isMobile && !sidebarOpen}
        >
          <nav className={layout.sidebarNav} aria-label="主导航">
          {menuItems.map((item) => {
            const isActive = activeKey === item.key;
            const Icon = item.Icon;
            return (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "page" : undefined}
                className={`${layout.menuItem} ${isActive ? layout.menuItemActive : ""}`}
                onClick={() => handleNavigate(item.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNavigate(item.path);
                  }
                }}
              >
                <span className={layout.menuIcon} aria-hidden>
                  <Icon />
                </span>
                <span className={layout.menuLabel}>{item.label}</span>
              </div>
            );
          })}
          </nav>
        </aside>

        <main className={layout.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
