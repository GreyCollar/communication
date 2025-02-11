import { account } from "../account";
import { getKnowledge } from "../api/getKnowledge";

let lastKnowledgeState = [];
let isPollingActive = false;
const POLLING_INTERVAL = 60000;

const startKnowledgePolling = async (app, channelId, session) => {
  if (isPollingActive) return;

  isPollingActive = true;
  lastKnowledgeState = await getKnowledge(session);

  setInterval(async () => {
    try {
      const newKnowledge = await getKnowledge(session);

      if (JSON.stringify(newKnowledge) !== JSON.stringify(lastKnowledgeState)) {
        await app.client.chat.postMessage({
          channel: channelId || `C07QHJ38M7S`,
          text: "🔔 Knowledge base has been updated! Check the latest changes.",
        });

        lastKnowledgeState = newKnowledge;
      }
    } catch (error) {
      console.error("Error polling knowledge:", error);
    }
  }, POLLING_INTERVAL);
};

const listenNotifications = async ({ body, client }) => {
  const channelId = body.channel.id;

  startKnowledgePolling(client, channelId, account(body.user));
};

export { listenNotifications };

