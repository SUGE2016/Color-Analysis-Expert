import React from 'react';
import { ReactComponent as LogoSvg } from '../../assets/logo.svg';
import { APP_NAME } from '../../buildInfo';

/**
 * 全站统一 Logo（与登录页同源 src/assets/logo.svg）
 * @param {number} [size] - 宽高（px），不传则由 className / 父容器控制尺寸
 */
export default function AppLogo({ size, className, style, ariaLabel = APP_NAME }) {
  const dimStyle = size != null ? { width: size, height: size } : undefined;
  return (
    <LogoSvg
      className={className}
      style={{ display: 'block', ...dimStyle, ...style }}
      role="img"
      aria-label={ariaLabel}
      focusable="false"
    />
  );
}
