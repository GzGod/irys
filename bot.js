const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

// === 配置 ===
const API_KEY = '你的yescaptcha的api';
const SITE_KEY = '0x4AAAAAAA6vnrvBCtS4FAl-';
const WEBSITE_URL = 'https://irys.xyz/faucet';

// === 读取地址和代理 ===
const addresses = fs.readFileSync('address.txt', 'utf-8').trim().split('\n');
const proxies = fs.readFileSync('proxies.txt', 'utf-8').trim().split('\n');

if (addresses.length !== proxies.length) {
  console.error('地址数量和代理数量不一致！');
  process.exit(1);
}

// === 创建 CAPTCHA 任务 ===
async function createCaptchaTask(wallet, proxy) {
  const axiosProxy = axios.create({
    httpsAgent: new HttpsProxyAgent(proxy)
  });

  const { data: taskRes } = await axiosProxy.post('https://api.yescaptcha.com/createTask', {
    clientKey: API_KEY,
    task: {
      type: 'TurnstileTaskProxyless',
      websiteURL: WEBSITE_URL,
      websiteKey: SITE_KEY
    }
  });

  if (!taskRes.taskId) {
  console.error(`❌ 创建 CAPTCHA 失败 - ${wallet}`);
  console.error('返回内容：', taskRes);
  return;
}
  return taskRes.taskId;
}

// === 轮询 CAPTCHA 结果 ===
async function getCaptchaResult(taskId, wallet) {
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: res } = await axios.post('https://api.yescaptcha.com/getTaskResult', {
      clientKey: API_KEY,
      taskId
    });

    if (res.status === 'ready') return res.solution.token;
    else console.log(`⏳ 等待 CAPTCHA：${wallet}`);
  }
}

// === 请求 Faucet ===
async function requestFaucet(wallet, token, proxy) {
  const client = axios.create({
    httpsAgent: new HttpsProxyAgent(proxy),
    headers: {
      'Content-Type': 'application/json',
      'Origin': WEBSITE_URL,
      'Referer': WEBSITE_URL,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const res = await client.post('https://irys.xyz/api/faucet', {
    captchaToken: token,
    walletAddress: wallet
  });

  return res.data;
}

// === 主流程 ===
(async () => {
  for (let i = 0; i < addresses.length; i++) {
    const wallet = addresses[i].trim();
    const proxy = proxies[i].trim();

    console.log(`🚀 开始领取：${wallet}（代理：${proxy}）`);

    try {
      const taskId = await createCaptchaTask(wallet, proxy);
      const captchaToken = await getCaptchaResult(taskId, wallet);
      const result = await requestFaucet(wallet, captchaToken, proxy);
      console.log(`✅ 成功领取 ${wallet}：`, result.message);
    } catch (err) {
      console.error(`❌ ${wallet} 出错：`, err.response?.data || err.message);
    }

    console.log('-----------------------------');
  }
})();
