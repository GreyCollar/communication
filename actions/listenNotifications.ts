import { account } from "../account";
import { getKnowledge } from "../api/getKnowledge";
import storage from "../Storage";

const POLLING_INTERVAL = Number(process.env.POLLING_INTERVAL) || 30000;

let lastKnowledgeState = [];
let pollingInterval: NodeJS.Timeout;

interface KnowledgeEntry {
  id: string;
  type: string;
  status: string;
  text?: string;
  url?: string;
  question?: string;
  answer?: string;
  createdAt: string;
  content?: string;
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
};

const startKnowledgePolling = async ({ body, ack, client }) => {
  await ack();
  const channelId = body.channel.id;
  const { user } = body.message;
  
  const session = account(user);
  await storage.set("selectedTeamId", body.actions[0].selected_option.value);
  
  stopPolling();
  
  lastKnowledgeState = await getKnowledge(session);
  
  pollingInterval = setInterval(async () => {
    const newKnowledge = await getKnowledge(session);
    
    const newEntries = newKnowledge.filter(
      (entry: KnowledgeEntry) =>
        !lastKnowledgeState.some(
          (old: KnowledgeEntry) => old.id === entry.id
        )
    );

    for (const entry of newEntries) {
      const formattedDate = new Date(entry.createdAt).toLocaleString();
      
      let messageText =
        `🔔 *New Knowledge Entry Added!*\n` +
        `Type: ${entry.type}\n` +
        `Status: ${entry.status}\n` +
        `Created: ${formattedDate}\n`;

      if (entry.text) messageText += `Content: ${entry.text}\n`;
      if (entry.url) messageText += `URL: ${entry.url}\n`;
      if (entry.question) messageText += `Question: ${entry.question}\n`;
      if (entry.answer) messageText += `Answer: ${entry.answer}\n`;

      await client.chat.postMessage({
        channel: channelId,
        text: messageText,
        mrkdwn: true,
      });
    }

    lastKnowledgeState = newKnowledge;
  }, POLLING_INTERVAL);
};

const listenNotifications = async ({ body, ack, client }) => {
  startKnowledgePolling({ body, ack, client });
};

export { listenNotifications };