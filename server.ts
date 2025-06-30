import { Server } from "socket.io";
import { createApp } from "./app";
import { createChatApp } from "./chatApp";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { subscribe } from "nuc-node-event-test/client";

//import session from "./test_chat/session";

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

  const server = http.createServer(mainApp);

  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  //session.setup(io);

  const mainPort = process.env.MAIN_PORT || 3001;
  const scoketIoPort = process.env.SOCKET_IO_PORT || 3003;

  subscribe("TEST_EVENT", ({ message }) => {
    console.log(`⚡️ TEST_EVENT message received: ${message}`);
  });

  mainApp.listen(mainPort, () => {
    console.log(`⚡️ Main server running on port ${mainPort}`);
    console.log(`⚡️ Bot app accessible at /bot`);
    console.log(`⚡️ Chat app accessible at /chat`);
  });

  server.listen(scoketIoPort, () => {
    console.log(`⚡️ Socket.io server running on port ${scoketIoPort}`);
  });
};

startServer().catch(console.error);
