// 导入公共样式
import '@live-manager/common/style/config-warning.css';

interface ConfigRequiredPageProps {
  missingItems: string[];
}

/**
 * 配置缺失提示页面
 * 当检测到缺少 SDK_APP_ID、SECRET_KEY 或 USER_ID 时显示此页面
 */
export default function ConfigRequiredPage({ missingItems }: ConfigRequiredPageProps) {
  const getMissingLabel = (item: string) => {
    const labels: Record<string, string> = {
      'SDK_APP_ID': 'SdkAppId',
      'SECRET_KEY': 'SecretKey',
      'USER_ID': 'UserId',
    };
    return labels[item] || item;
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* 标题 */}
        <div className="login-header">
          <h1 className="login-title">LiveKit 管理后台</h1>
        </div>

        {/* 警告提示 */}
        <div className="config-warning">
          <div className="config-warning__title">配置缺失提示</div>
          <div className="config-warning__content">
            服务器缺少以下配置项：<br />
            {missingItems.map(item => (
              <span key={item} className="config-warning__item">{getMissingLabel(item)}</span>
            )).reduce((acc: React.ReactNode[], curr, idx) => {
              if (idx > 0) acc.push('、');
              acc.push(curr);
              return acc;
            }, [])}
            <br /><br />
            请在 server 的 <code>config/.env</code> 文件中或者在运行环境的环境配置中配置以下环境变量：
            <ul className="config-warning__list">
              <li><code>SDK_APP_ID</code> - 腾讯云 SDK AppID</li>
              <li><code>SECRET_KEY</code> - 腾讯云 SecretKey</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
