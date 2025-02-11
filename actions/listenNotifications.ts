import { account } from "../account";
import { getKnowledge } from "../api/getKnowledge";
import storage from "../Storage";

let lastKnowledgeState = [];
let isPollingActive = false;
const POLLING_INTERVAL = 60000;

const startKnowledgePolling = async ({ body, ack, client }) => {
  await ack();

  await storage.set("selectedTeamId", body.actions[0].selected_option.value);

  const { user } = body.message;

  const session = account(user);

  if (isPollingActive) return;

  isPollingActive = true;
  lastKnowledgeState = await getKnowledge(session);

  setInterval(async () => {
    try {
      const newKnowledge = await getKnowledge(session);

      if (JSON.stringify(newKnowledge) !== JSON.stringify(lastKnowledgeState)) {
        await client.chat.postMessage({
          channel: body.channel.id,
          text: "🔔 Knowledge base has been updated! Check the latest changes.",
        });

        lastKnowledgeState = newKnowledge;
      }
    } catch (error) {
      console.error("Error polling knowledge:", error);
    }
  }, POLLING_INTERVAL);
};

const listenNotifications = async ({ body, ack, client }) => {
  startKnowledgePolling({ body, ack, client });
};

export { listenNotifications };

