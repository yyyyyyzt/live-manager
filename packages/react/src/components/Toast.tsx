import { MessagePlugin } from 'tdesign-react';

export const Message = {
  success: (msg: string) => MessagePlugin.success(msg),
  error: (msg: string) => MessagePlugin.error(msg),
  warning: (msg: string) => MessagePlugin.error(msg),
  info: (msg: string) => MessagePlugin.info(msg)
};

export default Message;
