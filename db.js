// db.js
const mysql = require('mysql2/promise'); // 使用支持 Promise 的 MySQL 驱动

// 数据库配置（根据你的实际情况修改）
const config = {
  host: 'localhost',     // 数据库服务器地址
  user: 'root',          // 数据库用户名
  password: 'a35064090235', // 数据库密码
  database: 'user_system',   // 数据库名称
  port: 3306,            // MySQL 默认端口
  waitForConnections: true, // 无可用连接时是否等待
  connectionLimit: 10,    // 连接池最大连接数
  queueLimit: 0          // 等待队列长度（0 表示不限制）
};

// 创建连接池
const pool = mysql.createPool(config);

// 测试连接是否成功（可选）
pool.getConnection()
  .then(connection => {
    console.log('✅ 数据库连接成功');
    connection.release(); // 释放连接回池中
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1); // 连接失败则退出进程
  });

// 导出连接池
module.exports = pool;