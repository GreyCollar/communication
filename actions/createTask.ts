import { AnyBlock } from "@slack/types";

const createTask = async ({ body, ack, client, action }) => {
  await ack();

  const colleague =
    body.message.attachments[0].blocks[0].text.text.split("*")[1];

  let blocks: AnyBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:pencil2: You've chosen *${colleague}* \nPlease enter the describe task:`,
      },
    },
  ];

  blocks.push({
    type: "input",
    block_id: "text_block",
    element: {
      type: "plain_text_input",
      action_id: "text_input",
      multiline: true,
    },
    label: {
      type: "plain_text",
      text: "Text :memo:",
    },
  });

  try {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      attachments: [
        {
          color: "#ff9900",
          blocks: blocks,
        },
      ],
    });
  } catch (error) {
    console.error("Error updating message:", error);
  }
};

export { createTask };

