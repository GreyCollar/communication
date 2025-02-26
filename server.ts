import { createApp } from "./app";
import { createChatApp } from "./chatApp";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const startServer = async () => {
  const mainApp = express();

  const slackApp = createApp();

  const slackPort = process.env.SLACK_PORT || 3002;

  await slackApp.start(slackPort);

  const slackProxy = createProxyMiddleware({
    target: `http://localhost:${slackPort}`,
    ws: true,
    pathRewrite: {
      "^/bot": "",
    },
  });

  mainApp.use("/bot", slackProxy);

  const mainPort = process.env.MAIN_PORT || 3001;
  mainApp.listen(mainPort, () => {
    console.log(`⚡️ Main server running on port ${mainPort}`);
    console.log(`⚡️ Bot app accessible at /bot`);
    console.log(`⚡️ Chat app accessible at /chat`);
  });
};

startServer().catch(console.error);
