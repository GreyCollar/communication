import { account } from "../account";
import { getKnowledge } from "../api/getKnowledge";
import storage from "../Storage";

let lastKnowledgeState = [];
let isPollingActive = false;
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
    isPollingActive = false;
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

const startKnowledgePolling = async ({ body, ack, client }) => {
  await ack();

  const channelId = body.channel.id;
  const messageTs = body.message.ts;

  const { user } = body.message;
  await storage.set("selectedTeamId", body.actions[0].selected_option.value);


  try {
    const session = account(user);

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

    await storage.set("selectedTeamId", body.actions[0].selected_option.value);

    if (isPollingActive) return;

    isPollingActive = true;
    lastKnowledgeState = await getKnowledge(session);

    pollingInterval = setInterval(async () => {
      try {
        const newKnowledge = await getKnowledge(session);

        if (
          JSON.stringify(newKnowledge) !== JSON.stringify(lastKnowledgeState)
        ) {
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

            if (entry.text) {
              messageText += `Content: ${entry.text}\n`;
            }

            if (entry.url) {
              messageText += `URL: ${entry.url}\n`;
            }

            if (entry.question) {
              messageText += `Question: ${entry.question}\n`;
            }

            if (entry.answer) {
              messageText += `Answer: ${entry.answer}\n`;
            }

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
          return;
        }

        console.error("Error polling knowledge:", error);
        await client.chat.postMessage({
          channel: channelId,
          text: "⚠️ Error checking for knowledge base updates. Will retry later.",
        });
      }
    }, 60000);
  } catch (error: any) {
    console.error("Error in startKnowledgePolling:", error);
    await client.chat.postMessage({
      channel: channelId,
      text: "⚠️ An error occurred while starting the knowledge polling.",
    });
  }
};

const listenNotifications = async ({ body, ack, client }) => {
  startKnowledgePolling({ body, ack, client });
};

export { listenNotifications };

