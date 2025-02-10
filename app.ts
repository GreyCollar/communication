import { App } from "@slack/bolt";
import { account } from "./account";
import { colleagueSelect } from "./actions/colleagueSelect";
import { createTask } from "./actions/createTask";
import { getKnowledge } from "./api/getKnowledge";
import { handleLearnType } from "./actions/handleLearnType";
import { learn } from "./commands/learn";
import { selectLearnType } from "./actions/selectLearnType";
import { sendTask } from "./actions/sendTask";
import { submitLearnInfo } from "./actions/submitLearnInfo";
import { task } from "./commands/task";
import { teamSelect } from "./actions/teamSelect";

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

const createApp = () => {
  const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
  });

  app.event("app_home_opened", async ({ event, client }) => {
    await client.views.publish({
      user_id: event.user,
      view: {
        type: "home",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🏠 Welcome to Your App Home!",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Knowledge Updates* 🔔",
            },
            accessory: {
              type: "button",
              action_id: "toggle_knowledge_updates",
              text: {
                type: "plain_text",
                text: isPollingActive ? "Stop Updates" : "Start Updates",
                emoji: true,
              },
              value: isPollingActive ? "stop" : "start",
            },
          },
        ],
      },
    });
  });

  app.command("/learn", learn);
  app.action("learn_team_select", teamSelect);
  app.action("learn_colleague_select", colleagueSelect);
  app.action("select_learn_type", selectLearnType);
  app.action(/^learn_type_/, handleLearnType);
  app.action("submit_learn_info", submitLearnInfo);

  app.command("/task", task);
  app.action("task_team_select", teamSelect);
  app.action("task_colleague_select", colleagueSelect);
  app.action("create_task", createTask);
  app.action("send_task", sendTask);

  app.action(
    "toggle_knowledge_updates",
    async ({ ack, body, client, action }) => {
      await ack();

      if (!("value" in action)) {
        return;
      }

      if (action.value === "start") {
        const channelId = process.env.NOTIFICATION_CHANNEL_ID;
        const session = account(body.user.id);

        await startKnowledgePolling(app, channelId, session);
      } else {
        isPollingActive = false;
      }

      await client.views.publish({
        user_id: body.user.id,
        view: {
          type: "home",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🏠 Welcome to Your App Home!",
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Knowledge Updates* 🔔",
              },
              accessory: {
                type: "button",
                action_id: "toggle_knowledge_updates",
                text: {
                  type: "plain_text",
                  text: isPollingActive ? "Stop Updates" : "Start Updates",
                  emoji: true,
                },
                value: isPollingActive ? "stop" : "start",
              },
            },
          ],
        },
      });
    }
  );

  return app;
};

export { createApp };
