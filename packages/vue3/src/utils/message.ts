import { createDiscreteApi } from 'naive-ui';

/** 不依赖组件树即可调用的 Naive 反馈 API（便于从旧 TDesign MessagePlugin 迁移） */
const { message, dialog, notification } = createDiscreteApi(['message', 'dialog', 'notification'], {});

export { message, dialog, notification };
