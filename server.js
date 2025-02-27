const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const redis = require('redis');

const app = express();
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
app.use(bodyParser.json());


const redisClient = redis.createClient({
  
});


redisClient.on('connect', () => console.log('Redis 已连接'));
redisClient.on('error', (err) => console.error('Redis 错误:', err));


redisClient.connect()
  .then(() => {
    app.listen(3001, () => {
      console.log('后端服务已启动：http://localhost:3001');
    });
  })
  .catch((err) => {
    console.error('Redis 初始化失败:', err);
    process.exit(1);
  });


app.post('/api/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();


    if (!redisClient.isReady) {
      await redisClient.connect();
    }

    await redisClient.setEx(`code:${phone}`, 300, code);
    console.log(`[模拟短信] 验证码 ${code} 发送到 ${phone}`);
    res.json({ success: true });
  } catch (err) {
    console.error('接口错误:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/register', async (req, res) => {
  const { phone, code } = req.body;
  

  const storedCode = await redisClient.get(`code:${phone}`);
  
  if (!storedCode) {
    return res.json({ success: false, message: '验证码错误' });
  }
  
  if (code !== storedCode) {
    return res.json({ success: false, message: '验证码错误' });
  }
  

  console.log(`用户 ${phone} 注册成功`);
  

  await redisClient.del(`code:${phone}`);
  
  res.json({ success: true });
});
