const express = require('express');

const bodyParser = require('body-parser');
const pool = require('./db');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const router = express.Router();

const allowedOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500','http://localhost:3004','http://localhost:3003'];

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
  // 在所有响应中添加：
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});
app.use(bodyParser.json());
app.use('/api', router);
const authenticate = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // 直接返回 200
  }
  
  const token = req.headers.authorization?.split(' ')[1];
  console.log('[DEBUG] Token:', token);
  if (!token) return res.status(401).json({ error: '未授权' });

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: '无效令牌' });
  }
};

router.use(authenticate);

// 获取好友列表
router.get('/friends/:account', async (req, res) => {
  try {
    const [friends] = await pool.query(`
      SELECT u.account, u.username, f.status 
      FROM friendships f
      JOIN users u ON f.friend_account = u.account
      WHERE f.user_account = ? AND f.status = 'accepted'
    `, [req.params.account]);

    res.json(friends);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

//
router.post('/friends', async (req, res) => {
  try {
    const userAccount = req.user.account; // 从 JWT 中获取
    const { friendAccount } = req.body; 

    // 检查是否已存在请求
    const [existing] = await pool.query(
      `SELECT * FROM friendships 
      WHERE user_account = ? AND friend_account = ?`,
      [userAccount, friendAccount]
    );

    const [userExists] = await pool.query(
      'SELECT account FROM users WHERE account = ?',
      [friendAccount]
    );

    if (userExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: '目标账号不存在'
      });
    }

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: '好友请求已发送，请勿重复操作'
      });
    }

    // 插入新的待处理请求
    await pool.query(
      `INSERT INTO friendships 
      (user_account, friend_account, status) 
      VALUES (?, ?, 'pending')`,
      [userAccount, friendAccount]
    );

    res.json({ 
      success: true,
      message: '好友请求已发送，等待对方确认'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      error: '服务器错误' 
    });
  }
});
//


         
//待确认
router.get('/friends/pending/:account', async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT u.account, u.username 
      FROM friendships f
      JOIN users u ON f.user_account = u.account
      WHERE f.friend_account = ? AND f.status = 'pending'`,
      [req.params.account]
    );

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      error: '获取请求失败' 
    });
  }
});

// 发送消息
router.post('/messages', async (req, res) => {
  const { sender, receiver, content } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)',
      [sender, receiver, content]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 在 server_fri.js 中添加以下路由
router.put('/friends/confirm', async (req, res) => {
  try {
    const { userAccount, friendAccount } = req.body;

    // 开启事务保证数据一致性
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 步骤1：将原始请求状态改为accepted
      const [updateResult] = await connection.query(
        `UPDATE friendships 
        SET status = 'accepted'
        WHERE user_account = ? 
        AND friend_account = ?
        AND status = 'pending'`,
        [friendAccount, userAccount]  // 注意参数顺序：请求方是friendAccount
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ 
          success: false,
          error: '未找到待处理请求' 
        });
      }

      // 步骤2：创建反向好友关系
      await connection.query(
        `INSERT INTO friendships 
        (user_account, friend_account, status)
        VALUES (?, ?, 'accepted')`,
        [userAccount, friendAccount]
      );

      await connection.commit();
      res.json({ 
        success: true,
        message: '好友请求已接受' 
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('接受请求失败:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || '服务器错误' 
    });
  }
});


router.delete('/friends/reject', async (req, res) => {
  try {
    const { userAccount, friendAccount } = req.body;
    await pool.query(
      `DELETE FROM friendships 
      WHERE user_account = ? AND friend_account = ? AND status = 'pending'`,
      [friendAccount, userAccount]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取聊天记录
router.get('/messages/:user1/:user2', async (req, res) => {
  try {
    const [messages] = await pool.query(`
      SELECT * FROM messages 
      WHERE (sender = ? AND receiver = ?)
      OR (sender = ? AND receiver = ?)
      ORDER BY timestamp
    `, [req.params.user1, req.params.user2, req.params.user2, req.params.user1]);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动: http://localhost:${PORT}`);
});
    

