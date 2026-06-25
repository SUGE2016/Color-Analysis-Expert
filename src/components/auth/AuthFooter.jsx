import React from 'react';
import { Typography } from 'antd';
import { APP_COPYRIGHT, APP_VERSION, APP_BUILD } from '../../buildInfo';
import styles from '../../styles/auth-page.module.css';

const { Text } = Typography;

export default function AuthFooter() {
  const year = new Date().getFullYear();
  return (
    <div className={styles.footer}>
      <Text type="secondary" className={styles.footerText}>
        © {year} {APP_COPYRIGHT}
      </Text>
      <Text type="secondary" className={styles.footerMeta}>
        v{APP_VERSION} · Build {APP_BUILD}
      </Text>
    </div>
  );
}
