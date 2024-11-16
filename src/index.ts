import { HandlerContext, processMultilineResponse, run, textGeneration } from "@xmtp/message-kit";
import { agent_prompt } from "./prompt.js";

run(async (context: HandlerContext) => {
	const {
		message: {
			content: { text, reply, params },
			sender,
			typeId,
		},
	} = context;

	try {
		let userMessage = "";

		if (typeId === "text") {
			userMessage = text ?? "";
		}

		if (typeId === "reply") {
			userMessage = reply ?? "";
		}

		const userPrompt = params?.prompt ?? userMessage;

		const { reply: agentReply } = await textGeneration(sender.address, userPrompt, await agent_prompt(sender.address));
		await processMultilineResponse(sender.address, agentReply, context);
	} catch (error) {
		console.error("Error during OpenAI call:", error);
		await context.send("An error occurred while processing your request.");
	}
}).then();
