const express = require('express');
const path = require('path');
const { apiRouter } = require('./routes/index.js');
const processCors = require('./middleware/processCors.js');
const { credentialProxy } = require('./middleware/credentialProxy.js');
const { Config } = require('../config/index.js');
const logger = require('./utils/logger.js');

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(processCors);
app.use(credentialProxy);
app.use('/api', apiRouter);

// 全局错误处理中间件
app.use((err, req, res, next) => {
  // 记录错误日志
  logger.error('GLOBAL_ERROR', err, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query
  });

  // 返回错误响应
  res.status(err.status || 500).json({
    code: -1,
    message: err.message || 'Internal Server Error'
  });
});

// Serve frontend static files (for production deployment)
// Vue and React coexist under /vue and /react directories
const publicPath = path.resolve(__dirname, '../public');

// React SPA（唯一内置管理端）
const reactPath = path.join(publicPath, 'react');
app.use('/react', express.static(reactPath));
app.get('/react/*', (req, res) => {
  res.sendFile(path.join(reactPath, 'index.html'));
});

// Root redirect到 React 构建目录
app.get('/', (req, res) => {
  res.redirect('/react/');
});

app.listen(Config.Port, err => {
  if (!!err) {
    console.error(err);
  } else {
    console.log('Express server started on port: ' + Config.Port.toString());
  }
});
