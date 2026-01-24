import http from "http";
import https from "https";

const GLM_API_KEY = process.env.GLM_API_KEY;
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
            const incomingData = JSON.parse(body);

            console.log("\n--- Incoming Request ---");
            console.log(JSON.stringify(incomingData, null, 2));

            const requestData = {
                model: "glm-4.7",
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

            console.log("\n--- Outgoing Request to GLM ---");
            console.log(JSON.stringify(requestData, null, 2));

            const postData = JSON.stringify(requestData);

            const options = {
                hostname: "api.z.ai",
                port: 443,
                path: "/api/coding/paas/v4/chat/completions",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                    Authorization: `Bearer ${GLM_API_KEY}`,
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
    console.log(`GLM Deep Thinking Proxy running on http://localhost:${PORT}`);
});

