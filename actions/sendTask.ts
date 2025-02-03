import { account } from "../account";
import { createTask } from "../api/createTask";

const sendTask = async ({ body, ack, client }) => {
  await ack();

  const { user } = body.message;

  const session = account(user);

  const colleague = body.message.attachments[0].blocks[0].text.text
    .split("*")[1]
    .split("*")[0]
    .trim();

  const colleagueId = body.message.metadata.event_payload.colleagueId;
  const description = body.state.values.task_block.task_input.value;

  try {
    await createTask(session, description, "IN_PROGRESS", colleagueId);
    const successMessage = `Task Created Successful! Colleague: ${colleague}`;

    await client.chat.delete({
      channel: body.channel.id,
      ts: body.message.ts,
    });

    await client.chat.postMessage({
      channel: body.channel.id,
      text: successMessage,
      attachments: [
        {
          color: "#36a64f",
          fallback: successMessage,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:white_check_mark: *Task Created Successful!*\n\n:bust_in_silhouette: *Colleague:* ${colleague}\n:Task:\n${description}`,
              },
            },
          ],
        },
      ],
    });
  } catch (error) {
    const errorMessage = `Task Submission Failed. Please try again later.`;

    await client.chat.postMessage({
      channel: body.channel.id,
      text: errorMessage,
      attachments: [
        {
          color: "#ff0000",
          fallback: errorMessage,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:x: *Learning Submission Failed*\n\nSomething went wrong !\n\n:bust_in_silhouette: *Colleague:* ${colleague}`,
              },
            },
          ],
        },
      ],
    });
  }
};

export { sendTask };

