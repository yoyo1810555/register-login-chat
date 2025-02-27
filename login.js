// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');

// ================== 必需中间件 ==================
// 替换 app.use(cors());
const allowedOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500'];
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('请求源未授权'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});
app.use(bodyParser.json()); // 解析JSON请求体  

// ================== 数据库配置 ==================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'a35064090235', // 修改为你的MySQL密码
  database: 'user_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ================== 登录接口实现 ==================
app.post('/api/login', async (req, res) => {
  // 调试日志：确保请求到达
  console.log('[登录请求] 收到登录请求:', req.body);

  try {
    const { account, password } = req.body;

    // 输入验证
    if (!account || !password) {
      console.log('[参数错误] 缺少必要参数');
      return res.status(400).json({
        success: false,
        message: '账号和密码不能为空'
      });
    }

    // 数据库查询（带调试日志）
    console.log(`[数据库] 正在查询账号: ${account}`);
    const [rows] = await pool.query(
      'SELECT username, password FROM users WHERE account = ?',
      [account]
    );

    // 处理查询结果
    if (rows.length === 0) {
      console.log(`[账号不存在] 账号: ${account}`);
      return res.status(404).json({
        success: false,
        message: '账号不存在'
      });
    }

    const user = rows[0];
    console.log(`[用户找到] 用户名: ${user.username}`);

    // 密码验证
    console.log('[密码验证] 开始验证密码...');
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      console.log('[密码错误] 验证失败');
      return res.status(401).json({
        success: false,
        message: '密码错误'
      });
    }
      
    // 登录成功响应
    console.log('[登录成功] 用户:', user.username);

    const token = jwt.sign(
      { account: account }, 
      'your_jwt_secret', // 替换为安全的密钥
      { expiresIn: '1h' }
    );


    //
    res.json({
      success: true,
      username: user.username,
      token: token, // 新增 token 字段
      account: account,
      message: '登录成功'
    });
    //

  } catch (error) {
    console.error('[系统错误] 登录流程异常:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// ================== 服务器启动 ==================
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动: http://localhost:${PORT}`);
});