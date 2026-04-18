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

// Vue SPA
const vuePath = path.join(publicPath, 'vue');
app.use('/vue', express.static(vuePath));
app.get('/vue/*', (req, res) => {
  res.sendFile(path.join(vuePath, 'index.html'));
});

// React SPA
const reactPath = path.join(publicPath, 'react');
app.use('/react', express.static(reactPath));
app.get('/react/*', (req, res) => {
  res.sendFile(path.join(reactPath, 'index.html'));
});

// Root redirect to /vue/
app.get('/', (req, res) => {
  res.redirect('/vue/');
});

app.listen(Config.Port, err => {
  if (!!err) {
    console.error(err);
  } else {
    console.log('Express server started on port: ' + Config.Port.toString());
  }
});
