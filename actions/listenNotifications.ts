import { account } from "../account";
import { getKnowledge } from "../api/getKnowledge";
import storage from "../Storage";

const POLLING_INTERVAL = Number(process.env.POLLING_INTERVAL) || 30000;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000;

let pollingInterval: NodeJS.Timeout;
let lastKnowledgeState = [];
let isPollingActive = false;
let retryCount = 0;

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    isPollingActive = false;
    retryCount = 0;
  }
};

const handleUnauthorized = async (
  client,
  channelId: string,
  messageTs: string
) => {
  stopPolling();

  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    metadata: {},
    attachments: [
      {
        color: "#FF0000",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "❌ Session expired. Please authenticate again.",
            },
          },
        ],
      },
    ],
  });
};

const pollKnowledge = async (session, client, channelId: string, messageTs: string) => {
  try {
    const newKnowledge = await getKnowledge(session);
    retryCount = 0;

    if (JSON.stringify(newKnowledge) !== JSON.stringify(lastKnowledgeState)) {
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
    }
  } catch (error: any) {
    if (error.status === 401 || error.response?.status === 401) {
      await handleUnauthorized(client, channelId, messageTs);
      return false;
    }

    retryCount++;
    console.error(`Error polling knowledge (attempt ${retryCount}/${MAX_RETRY_ATTEMPTS}):`, error);
    
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      await client.chat.postMessage({
        channel: channelId,
        text: "⚠️ Multiple errors occurred. Restarting polling system...",
      });
      
      await sleep(RETRY_DELAY);
      retryCount = 0;
    }
  }
  return true;
};

const startKnowledgePolling = async ({ body, ack, client }) => {
  await ack();

  const channelId = body.channel.id;
  const messageTs = body.message.ts;
  const { user } = body.message;
  
  try {
    const session = account(user);
    await storage.set("selectedTeamId", body.actions[0].selected_option.value);

    try {
      await getKnowledge(session);
    } catch (error: any) {
      if (error.status === 401 || error.response?.status === 401) {
        await handleUnauthorized(client, channelId, messageTs);
        return;
      }
      throw error;
    }

    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      metadata: {},
      attachments: [
        {
          color: "#3366cc",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🔔 Listening to knowledge updates...",
              },
            },
          ],
        },
      ],
    });

    if (isPollingActive) return;

    isPollingActive = true;
    lastKnowledgeState = await getKnowledge(session);

    const startPolling = async () => {
      if (!isPollingActive) return;
      
      const shouldContinue = await pollKnowledge(session, client, channelId, messageTs);
      
      if (shouldContinue) {
        pollingInterval = setTimeout(startPolling, POLLING_INTERVAL);
      }
    };

    await startPolling();

  } catch (error: any) {
    console.error("Error in startKnowledgePolling:", error);
    await client.chat.postMessage({
      channel: channelId,
      text: "⚠️ An error occurred while starting the knowledge polling. Attempting to restart...",
    });
    
    await sleep(RETRY_DELAY);
    await startKnowledgePolling({ body, ack, client });
  }
};

const listenNotifications = async ({ body, ack, client }) => {
  startKnowledgePolling({ body, ack, client });
};

export { listenNotifications };