import React from 'react';
import { Typography } from 'antd';
import { APP_NAME } from '../../buildInfo';
import AppLogo from '../common/AppLogo';
import styles from '../../styles/auth-page.module.css';

const { Title, Paragraph } = Typography;

export default function AuthBrand() {
  return (
    <aside className={styles.brand}>
      <div className={styles.logo}>
        <AppLogo className={styles.logoImg} />
      </div>

      <Title level={3} className={styles.brandTitle}>
        {APP_NAME}
      </Title>

      <Paragraph className={styles.brandDesc}>
        儿童涂色数据采集与智能分析
      </Paragraph>
    </aside>
  );
}
