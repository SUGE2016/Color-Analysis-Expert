import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthSession from "../components/auth/AuthSession";
import PageLayout from "../components/layout/PageLayout";
// 登录页面
import LoginPage from "../pages/LoginPage";
// 数据集模块页面
import GroupListPage from "../pages/dataset/GroupListPage";
import DatasetListPage from "../pages/dataset/DatasetListPage";
import DatasetDetailPage from "../pages/dataset/DatasetDetailPage";
// 分析模块页面
import AnalysisPage from "../pages/analysis/AnalysisPage";
import AnalysisCreatePage from "../pages/analysis/AnalysisCreatePage";
// 报告模块页面
import SingleImageReportPage from "../pages/report/SingleImageReportPage";
import GlobalSummaryReportPage from "../pages/report/GlobalSummaryReportPage";
// 工具箱页面
import ToolboxPage from "../pages/ToolboxPage";
import EdgeDetectionPage from "../pages/toolbox/EdgeDetectionPage";
import ImageCorrectionPage from "../pages/toolbox/ImageCorrectionPage";
//import HelpPage from "../pages/HelpPage";
//import SettingsPage from "../pages/SettingsPage";

// 路由配置
const routesConfig = [
  // 根路由重定向到登录页面
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  // 登录页面（独立布局，无侧边栏）
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <Navigate to="/login" replace />,
  },
  // 主布局路由
  {
    path: "/",
    element: <PageLayout />,
    children: [
      // 数据集管理三级路由
      { path: "dataset", element: <GroupListPage /> }, // 分组列表
      { path: "dataset/group/:groupId", element: <DatasetListPage /> },
      { path: "dataset/group/:groupId/dataset/:datasetId", element: <DatasetDetailPage /> },
      
      // 分析模块路由
      { path: "analysis", element: <AnalysisPage /> },
      { path: "analysis/create", element: <AnalysisCreatePage /> },
      
      // 报告模块路由
      { path: "analysis/:projectId/report", element: <GlobalSummaryReportPage /> },
      { path: "analysis/:projectId/report/image/:imageId", element: <SingleImageReportPage /> },
      
      // 工具箱路由
      { path: "toolbox", element: <ToolboxPage /> },
      { path: "toolbox/edge-detection", element: <EdgeDetectionPage /> },
      { path: "toolbox/image-correction", element: <ImageCorrectionPage /> },
      //{ path: "help", element: <HelpPage /> },
      //{ path: "settings", element: <SettingsPage /> },
      
      // 404兜底
      { path: "*", element: <Navigate to="/dataset" replace /> }
    ],
  },
];

const AppRouter = () => {
  return (
    <BrowserRouter>
      <AuthSession>
      <Routes>
        {routesConfig.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={route.element}
          >
            {route.children?.map((child, i) => (
              <Route 
                key={i} 
                path={child.path} 
                element={child.element} 
              />
            ))}
          </Route>
        ))}
      </Routes>
      </AuthSession>
    </BrowserRouter>
  );
};

export default AppRouter;