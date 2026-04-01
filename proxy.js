import http from "http";
import https from "https";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PORT = process.env.PROXY_PORT || 3456;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on("end", () => {
        try {
            const remoteUrl = new URL(OPENROUTER_API_URL);
            const incomingData = JSON.parse(body);

            console.log("\n--- Incoming Request ---");
            console.log(JSON.stringify(incomingData, null, 2));

            const requestData = {
                model: "openrouter/free",
                reasoning: { enabled: true },
                messages: incomingData.messages || [],
                thinking: { type: "enabled" }
            };

            if (incomingData.temperature !== undefined) {
                requestData.temperature = incomingData.temperature;
            }
            if (incomingData.max_tokens !== undefined) {
                requestData.max_tokens = incomingData.max_tokens;
            }
            if (incomingData.stream !== undefined) {
                requestData.stream = incomingData.stream;
            }

            console.log("\n--- Outgoing Request to OpenRouter ---");
            console.log(JSON.stringify(requestData, null, 2));

            const postData = JSON.stringify(requestData);

            const options = {
                hostname: remoteUrl.hostname,
                port: 443,
                path: remoteUrl.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "X-Title": "Deep Thinker MCP",
                    "HTTP-Referer": "https://github.com/yasinozdgnn/deep-thinker"
                },
            };

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on("error", (e) => {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            });

            proxyReq.write(postData);
            proxyReq.end();
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`OpenRouter Deep Thinking Proxy running on http://localhost:${PORT}`);
});

