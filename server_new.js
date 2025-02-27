const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();


const corsOptions = {
  origin: 'http://localhost:5500', // 确保这是前端运行的地址
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 添加 OPTIONS 方法
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // 如果需要传递凭证（如 cookies）
};
app.use(cors(corsOptions));
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});
app.use(bodyParser.json());


const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'a35064090235',
  database: 'user_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        account VARCHAR(9) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(60) NOT NULL
      )
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

initializeDatabase();

async function generateUniqueAccount() {
  let isUnique = false;
  let account;
  
  while (!isUnique) {
    account = Math.floor(100000000 + Math.random() * 900000000).toString();
    const [rows] = await pool.query('SELECT * FROM users WHERE account = ?', [account]);
    if (rows.length === 0) isUnique = true;
  }
  return account;
}


app.post('/api/new_reg', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    // 生成账号
    const account = await generateUniqueAccount();
    
    // 密码加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 存储用户信息
    await pool.query(
      'INSERT INTO users (account, username, password) VALUES (?, ?, ?)',
      [account, username, hashedPassword]
    );

    res.status(201).json({ 
      success: true,
      account: account,
      message: '注册成功，请牢记您的账号'
    });

  } catch (error) {
    console.error('注册错误:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录接口
app.post('/api/login', async (req, res) => {
  try {
    const { account, password } = req.body;
    
    // 查询用户
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE account = ?',
      [account]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: '账号不存在' });
    }

    const user = rows[0];
    
    // 验证密码
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    res.json({ 
      success: true,
      username: user.username,
      message: '登录成功'
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 启动服务器
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});