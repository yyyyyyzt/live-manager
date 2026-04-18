import { useState, useEffect } from 'react';
import { Button, Input } from 'tdesign-react';

import { Message } from '../components/Toast';
import { checkServerConfig, login, saveCredentials, isLoggedIn, clearCredentials } from '../api/auth';
import {
  getUrlOverrideParams,
  setServerConfigured,
} from '@live-manager/common';
import { useAppNavigate } from '../hooks/useAppNavigate';

type LoginMode = 'loading' | 'credential';

interface CredentialFormData {
  userId: string;
  userSig: string;
  sdkAppId: string;
  domain: string;
}

/** 服务端配置状态 */
interface ServerConfigState {
  hasSdkAppId: boolean;
  hasSecretKey: boolean;
  sdkAppId: number;
}

export default function Login() {
  const navigate = useAppNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>('loading');

  // 服务端配置状态
  const [serverConfig, setServerConfig] = useState<ServerConfigState>({
    hasSdkAppId: false,
    hasSecretKey: false,
    sdkAppId: 0,
  });

  const [credentialForm, setCredentialForm] = useState<CredentialFormData>({
    userId: '',
    userSig: '',
    sdkAppId: '',
    domain: '',
  });

  useEffect(() => {
    // 检查 URL 参数
    const urlOverride = getUrlOverrideParams();

    // URL 中有参数 → 强制使用 URL 参数登录
    if (urlOverride) {
      console.log('[Login] 检测到 URL 参数，强制使用 URL 参数登录');
      clearCredentials(); // 清除旧凭证

      // URL override 模式：只传 sdkAppId，服务器会使用配置的 Identifier 作为 userId
      login({
        sdkAppId: urlOverride.sdkAppId,
      })
        .then((loginRes) => {
          if (loginRes.code === 0 && loginRes.data) {
            setServerConfigured(false); // 标记为非服务器配置
            saveCredentials(loginRes.data);
            navigate('/room-list', { replace: true });
          } else {
            Message.error(loginRes.message || 'URL 参数登录失败');
            setMode('credential');
          }
        })
        .catch((error: any) => {
          Message.error(error.message || 'URL 参数登录失败');
          setMode('credential');
        });
      return;
    }

    // 无 URL 参数 → 正常流程
    // 如果已登录，直接跳转
    if (isLoggedIn()) {
      console.log('[Login] 已登录，直接跳转');
      navigate('/room-list', { replace: true });
      return;
    }

    console.log('[Login] 未登录，开始检查配置...');

    // 检查 server 配置状态决定登录模式
    checkServerConfig()
      .then(async (res) => {
        console.log('[Login] checkServerConfig 返回:', JSON.stringify(res));
        const data = res.data;
        if (!data) {
          console.warn('[Login] checkServerConfig 返回 data 为空，显示凭证表单');
          setMode('credential');
          return;
        }

        const config: ServerConfigState = {
          hasSdkAppId: data.hasSdkAppId ?? false,
          hasSecretKey: data.hasSecretKey ?? false,
          sdkAppId: data.sdkAppId ?? 0,
        };
        setServerConfig(config);
        console.log('[Login] 服务端配置:', config);

        // 三项全配置 → 自动登录，跳过登录页
        if (config.hasSdkAppId && config.hasSecretKey) {
          console.log('[Login] 三项全配置，尝试自动登录...');
          try {
            const loginRes = await login({}); // 无参数自动登录
            console.log('[Login] login({}) 返回:', JSON.stringify(loginRes));
            if (loginRes.code === 0 && loginRes.data) {
              setServerConfigured(true); // 标记为服务器配置
              saveCredentials(loginRes.data);
              console.log('[Login] ✅ 自动登录成功，跳转 room-list');
              navigate('/room-list', { replace: true });
              return;
            } else {
              console.error('[Login] ❌ 自动登录失败:', loginRes.message);
              Message.error(loginRes.message || '自动登录失败，请检查服务器配置');
            }
          } catch (error: any) {
            console.error('[Login] ❌ 自动登录异常:', error);
            Message.error(error.message || '自动登录失败，请检查网络连接');
          }
        }

        // 未完整配置或自动登录失败 → 显示凭证表单
        console.log('[Login] 显示凭证表单');
        setCredentialForm(prev => ({
          ...prev,
          sdkAppId: config.hasSdkAppId ? String(config.sdkAppId) : '',
        }));
        setMode('credential');
      })
      .catch((err) => {
        // 网络错误时默认凭证模式
        console.error('[Login] checkServerConfig 请求失败:', err);
        setMode('credential');
      });
  }, [navigate]);

  const handleCredentialChange = (name: keyof CredentialFormData) => (value: string | number) => {
    setCredentialForm(prev => ({ ...prev, [name]: String(value) }));
  };

  const handleCredentialLogin = async () => {
    // 只校验服务端未配置的字段
    if (!serverConfig.hasSdkAppId && (!credentialForm.sdkAppId.trim() || isNaN(Number(credentialForm.sdkAppId)))) {
      Message.error('请输入有效的 SdkAppId');
      return;
    }

    if (!credentialForm.userSig.trim()) {
      Message.error('请输入 UserSig');
      return;
    }

    setLoading(true);
    try {
      const response = await login({
        userId: credentialForm.userId.trim() || undefined,
        userSig: credentialForm.userSig.trim(),
        sdkAppId: Number(credentialForm.sdkAppId.trim()),
        domain: credentialForm.domain.trim() || undefined,
      });
      if (response.code === 0 && response.data) {
        saveCredentials(response.data);
        Message.success('登录成功');
        navigate('/room-list');
      } else {
        Message.error(response.message || '登录失败');
      }
    } catch (error: any) {
      Message.error(error.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  /** 计算凭证模式下需要用户手动输入的字段 */
  const needSdkAppId = !serverConfig.hasSdkAppId;
  // UserSig 必须要用户提供（除非 server 有 SecretKey 能自动生成）
  const needUserSig = !serverConfig.hasSecretKey;

  /** 生成凭证模式的提示文字 */
  const getCredentialHint = () => {
    const missing: string[] = [];
    if (!serverConfig.hasSecretKey) missing.push('SecretKey');
    if (!serverConfig.hasSdkAppId) missing.push('SdkAppId');
    if (missing.length === 0) return '';
    return `服务端未配置 ${missing.join('、')}，需手动输入对应凭证。`;
  };

  if (mode === 'loading') {
    return (
      <div className="login-container">
        <div className="login-content">
          <div className="login-header">
            <h1 className="login-title">LiveKit 管理后台</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-content">
        {/* 标题 */}
        <div className="login-header">
          <h1 className="login-title">LiveKit 管理后台</h1>
        </div>

        {/* 登录表单 */}
        <div className="login-form-wrapper">
          {/* SdkAppId 字段 */}
          {needSdkAppId && (
            <div className="login-field login-field--horizontal">
              <label className="login-field__label">SdkAppId</label>
              <Input
                value={credentialForm.sdkAppId}
                onChange={handleCredentialChange('sdkAppId')}
                placeholder="请输入 SdkAppId（数字）"
                className="login-input"
              />
            </div>
          )}

          {/* UserId 字段 */}
          <div className="login-field login-field--horizontal">
            <label className="login-field__label">UserId</label>
            <Input
              value={credentialForm.userId}
              onChange={handleCredentialChange('userId')}
              placeholder="留空则使用服务器配置的 Identifier"
              className="login-input"
            />
          </div>

          {/* UserSig 字段 */}
          {needUserSig && (
            <div className="login-field login-field--horizontal">
              <label className="login-field__label">UserSig</label>
              <Input
                value={credentialForm.userSig}
                onChange={handleCredentialChange('userSig')}
                placeholder="请输入 UserSig"
                className="login-input"
                onEnter={handleCredentialLogin}
              />
            </div>
          )}

          {/* Domain 字段 */}
          <div className="login-field login-field--horizontal">
            <label className="login-field__label">Domain</label>
            <Input
              value={credentialForm.domain}
              onChange={handleCredentialChange('domain')}
              placeholder="留空则使用后端配置的 Domain"
              className="login-input"
            />
          </div>

          {/* 确认登录按钮 */}
          <Button
            theme="primary"
            loading={loading}
            onClick={handleCredentialLogin}
            shape='round'
            size='large'
          >
            确认登录
          </Button>

          {getCredentialHint() && (
            <div className="credential-hint">
              {getCredentialHint()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}